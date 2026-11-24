// Inside public buildings (art upgrade Phase 5A): schools, colleges and libraries; offices, banks and the stock
// exchange; shops, food courts and cafes; hospitals, clinics and the welfare office. One room of the building is
// shown (a classroom, an office floor, a ward), 14 x 9 tiles, one of three plans fixed per building. Only real
// people are in it: those whose position is inside this building now. Someone whose activity slot is WORK here is
// staff (behind the counter, at the desk, at the board, by the beds, in their uniform); everyone else is a visitor
// (pupils at desks, customers at tables and shelves, patients in beds or waiting). Drawing only: the world is read,
// never changed, and no world dice are used.
(function (LES) {
  'use strict';
  const R = LES.Room, A = () => LES.ArtPack, TS = 16;
  const hash = (...a) => R._hash(...a), top = r => R._top(r);

  R.PUBLIC_PLANS = {
    class: ['###W###V###W##', '.....AA.......', '..............', '.a.a.a.a.a.a..', '..............', '.a.a.a.a.a.a..', '..............', 'LL.........g..', '------E-------'],
    lab: ['##W####V###W##', '......P.......', '..............', '.BB..BB..BB...', '..............', '.BB..BB..BB...', '..............', 'LL..........g.', '------E-------'],
    lecture: ['###W##V###W###', '.....P........', '..............', '.a.a.a.a.a.a.a', '..............', '.a.a.a.a.a.a.a', '..............', '.a.a.a.a.a.a.a', '-------E------'],
    library: ['##W#######W###', 'SS.SS.SS.SS...', '..............', '.GG...GG...GG.', '..............', '.GG...GG......', '..............', '..........KKK.', '----E---------'],
    open: ['##W####W####W#', 'f.OO.OO.OO.OO.', '..............', '.OO.OO..GGG...', '..............', '.OO.OO........', 'p...........w.', '......KKK.....', '--------E-----'],
    bank: ['##W###W####W##', '..BBB...BBB...', '..............', '..............', '.hhh....hhh...', '..............', 't.t.........p.', '..............', '------E-------'],
    trade: ['###W##V#####W#', '.OO.OO.OO.OO..', '..............', '.OO.OO.OO.OO..', '..............', 'r.r.....GGG...', '..............', 'p.hhh......w..', '------E-------'],
    shop: ['##W######W####', 'SS.ss.SS.ss.F.', '..............', '.RR..RR..SS...', '..............', '.ss..SS..RR...', '..............', 'b....KK..KK...', '----E---------'],
    food: ['###W##V###W###', 'QQ.QQ.QQ.YY...', '..............', '.GG..GG..GG...', '..............', '.GG..GG..GG...', '..............', '.GG..GG.......', '-----E--------'],
    cafe: ['##W###V###W###', 'YY..CC........', '..............', '.TT..TT..TT...', '..............', '.TT..TT..TT...', '..............', '..........KK..', '------E-------'],
    ward: ['##W####W####W#', '.H.cc.H.cc.H..', '.H....H....H..', '..............', '.H.cc.H.cc.H..', '.H....H....H..', '..............', 'm.i.........w.', '------E-------'],
    clinic: ['##W###V####W##', '..KKK....OO...', '..............', '.hhh..hhh..uu.', '..............', '.hhh..hhh.....', '..............', 'w.........m...', '----E---------'],
    welfare: ['##W##V#####W##', '.JJJ...JJJ....', '..............', '..............', '.hhh..hhh..YY.', '..............', '.hhh..........', '..............', '-----E--------'],
  };
  const mirror = rows => rows.map(r => [...r].reverse().join(''));
  // Which plans each kind of building uses (three, fixed per building).
  const KIND_PLANS = {
    school: ['class', 'class:black', 'lab'], privschool: ['class', 'lab', 'class:black'], kolej: ['lecture', 'lab', 'library'], university: ['lecture', 'lab', 'library'],
    library: ['library', 'library:m', 'library'],
    office: ['open', 'open:m', 'trade'], hq: ['open', 'open:m', 'trade'], townhall: ['open', 'open:m', 'open'], researchcentre: ['lab', 'open', 'lab:m'],
    bank: ['bank', 'bank:m', 'bank'], bursa: ['trade', 'trade:m', 'open'], techhub: ['trade', 'open', 'trade:m'],
    shoplot: ['shop', 'shop:m', 'shop'], mall: ['shop', 'shop:m', 'food'], hawker: ['food', 'food:m', 'food'], mamak: ['cafe', 'cafe:m', 'food'], finedine: ['cafe', 'cafe:m', 'cafe'],
    hospital: ['ward', 'clinic', 'ward:m'], privhosp: ['ward', 'clinic', 'clinic:m'], welfare: ['welfare', 'welfare:m', 'clinic'],
  };
  const GROUP = { class: 'learn', lab: 'learn', lecture: 'learn', library: 'learn', open: 'office', bank: 'office', trade: 'office', shop: 'shop', food: 'food', cafe: 'food', ward: 'health', clinic: 'health', welfare: 'health' };
  const LOOK = {
    learn: { floor: ['pub.floor.class'], wall: ['pub.wall.cream'] }, office: { floor: ['pub.floor.office'], wall: ['pub.wall.grey'] }, shop: { floor: ['pub.floor.shop'], wall: ['pub.wall.shop', 'pub.wall.cream'] },
    food: { floor: ['pub.floor.terrazzo'], wall: ['pub.wall.cream'] }, health: { floor: ['pub.floor.hospital'], wall: ['pub.wall.green'] },
  };
  // What each letter of a plan is: sprite and role. Roles: teach (staff by the board), counter (staff behind,
  // customers in front), desk (staff seat), student (a pupil's desk), bench (seat behind a bench), table (seats),
  // wait (a row of chairs), bed, browse (customers in front), decor.
  const LEGEND = {
    A: ['pub.teacher_desk', 'desk', 'write'], a: ['pub.student_desk', 'student'], B: ['pub.lab_bench', 'bench'], P: ['pub.podium', 'teach'], L: ['pub.lockers', 'decor'], g: ['pub.globe', 'decor'],
    S: ['pub.shelf.0', 'browse'], s: ['pub.shelf.1', 'browse'], G: ['pub.reading_table', 'table', 'write'], K: ['pub.reception', 'counter'],
    O: ['pub.office_desk', 'desk', 'type'], f: ['pub.filing', 'decor'], p: ['pub.office_plant', 'decor'], w: ['pub.cooler', 'decor'], r: ['pub.server', 'decor'], t: ['pub.atm', 'browse'], h: ['pub.wait_chairs', 'wait'],
    R: ['pub.clothes', 'browse'], F: ['pub.drinks', 'browse'], b: ['pub.baskets', 'decor'], Q: ['pub.stall', 'counter'], Y: ['pub.roti', 'counter'], T: ['pub.rest_table', 'table', 'eat'], C: ['pub.coffee', 'counter'],
    H: ['pub.hosp_bed', 'bed'], c: ['pub.curtain', 'decor'], i: ['pub.iv', 'decor'], m: ['pub.med_cabinet', 'decor'], u: ['pub.couch', 'decor'], J: ['pub.welfare_counter', 'counter'],
  };
  // Letters that mean something else in a plan family.
  const BY_PLAN = {
    library: { K: ['pub.reception', 'counter'] }, open: { G: ['pub.meeting_table', 'table', 'write'], K: ['pub.reception', 'counter'] }, trade: { G: ['pub.meeting_table', 'table', 'write'] },
    bank: { B: ['pub.bank_counter', 'counter'] }, shop: { K: ['pub.checkout', 'counter'] }, food: { G: ['pub.court_table', 'table', 'eat'] }, cafe: { K: ['pub.checkout', 'counter'] },
    clinic: { K: ['pub.hosp_reception', 'counter'], O: ['pub.doctor_desk', 'desk', 'type'], w: ['pub.wheelchair', 'decor'] }, ward: { w: ['pub.wheelchair', 'decor'] }, welfare: { Y: ['pub.play_mat', 'decor'] },
  };
  const WALL = { class: 'pub.whiteboard', 'class:black': 'pub.blackboard', lecture: 'pub.screen', trade: 'pub.trading', food: 'pub.menu', cafe: 'pub.menu', clinic: 'pub.number', welfare: 'pub.number' };

  R.publicGroup = b => (b && KIND_PLANS[b.kind] && R.available() && A().has('pub.floor.class') ? GROUP[KIND_PLANS[b.kind][0].split(':')[0]] : null);
  R.publicPlanName = b => KIND_PLANS[b.kind][Math.floor(hash(b.id, 11) * 3)];

  // The plan of one public room: furniture, the staff places and the visitor places.
  R.planPublic = function (name) {
    const [base, opt] = name.split(':'), raw = R.PUBLIC_PLANS[base], rows = opt === 'm' ? mirror(raw) : raw, group = GROUP[base];
    const cols = rows[0].length, W = cols * TS, H = 16 + rows.length * TS, items = [], art = A();
    const spots = { teach: [], counter: [], desk: [], nurse: [], student: [], bench: [], table: [], wait: [], bed: [], browse: [], front: [], stand: [], lamp: [], flame: null };
    const add = (id, cx, bottom, extra) => { const [w, h] = art.size(id); const it = Object.assign({ id, x: Math.round(cx - w / 2), y: bottom - h, w, h, key: bottom }, extra || {}); items.push(it); return it; };
    const legend = Object.assign({}, LEGEND, BY_PLAN[base] || {});
    for (let c = 0; c < cols; c++) if (!'#W'.includes(rows[0][c])) { // the board, screen or menu on the back wall
      const id = WALL[opt === 'black' ? 'class:black' : base] || 'pub.whiteboard', [w, h] = art.size(id);
      items.push({ id, x: c * TS + 8 - Math.round(w / 2), y: Math.max(2, 26 - h), w, h, key: -1, wall: true });
      if (group === 'learn' && base !== 'library') spots.teach.push({ x: c * TS + 8, y: top(2) + 12, key: top(2) + 12, pose: 'talk' });
    }
    for (const q of R._rects(rows, Object.keys(legend).join(''))) {
      const L = legend[q.ch];
      if (!L) continue;
      const cx = (q.c0 + q.c1 + 1) * TS / 2, bottom = top(q.r1 + 1), it = add(L[0], cx, bottom), role = L[1];
      if (role === 'counter') { spots.counter.push({ x: cx, y: it.y + 12, key: it.key - 1, pose: 'serve' }); for (const dx of [-9, 9]) spots.front.push({ x: cx + dx, y: bottom + 14, key: bottom + 14, pose: 'stand' }); }
      else if (role === 'desk') spots.desk.push({ x: cx, y: it.y + 9, key: it.key - 1, pose: L[2] || 'type' });
      else if (role === 'teach') spots.teach.push({ x: cx, y: it.y + 12, key: it.key - 1, pose: 'talk' });
      else if (role === 'student') spots.student.push({ x: cx, y: it.key - 1, key: it.key + 0.5, pose: base === 'lecture' ? 'watch' : 'sitback' });
      else if (role === 'bench') spots.bench.push({ x: cx, y: it.y + 9, key: it.key - 1, pose: 'write' });
      else if (role === 'table') { spots.table.push({ x: it.x + 7, y: it.y + 9, key: it.key - 1, pose: L[2] }, { x: it.x + it.w - 7, y: it.y + 9, key: it.key - 1, pose: L[2] }); }
      else if (role === 'wait') for (let k = 0; k < 3; k++) spots.wait.push({ x: it.x + 8 + k * Math.round((it.w - 16) / 2), y: it.key - 3, key: it.key + 0.5, pose: 'sofa' });
      else if (role === 'bed') { spots.bed.push({ x: cx, y: it.y + 4, key: it.key + 0.5, pose: 'bed', view: 'top' }); spots.nurse.push({ x: cx + 14, y: it.key - 2, key: it.key, pose: 'talk' }); }
      else if (role === 'browse') spots.browse.push({ x: cx, y: bottom + 14, key: bottom + 14, pose: 'stand' });
    }
    const used = (x, y) => items.some(it => !it.wall && x >= it.x - 3 && x <= it.x + it.w + 3 && y >= it.y && y <= it.key + 6);
    for (let r = 2; r < rows.length - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const x = c * TS + 8, y = top(r) + 14;
      if (rows[r][c] === '.' && !used(x, y)) spots.stand.push({ x, y, key: y, pose: 'stand' });
    }
    const look = Object.assign({ floorKitchen: LOOK[group].floor, wallKitchen: LOOK[group].wall[0], window: ['my.window', 'my.window_curtain'], extras: [] }, LOOK[group]);
    return { rows, items, spots, W, H, look, group, name };
  };

  // Who is in the building now, staff or visitor, and what they came for: [{ p, staff, act, slot }].
  R.publicScene = function (w, r, b, t) {
    const tm = t * 1440, slotIdx = tm < LES.SLOT_B ? 0 : 1, out = [];
    for (const p of w.living) {
      if (!p.alive || p.away) continue;
      const pos = r.posOf(p, t, false);
      if (!(pos.inside === b.id || (pos.at === b.id && !pos.moving))) continue;
      const slot = p.plan && (p.plan[slotIdx] || p.plan[0]);
      out.push({ p, slot, act: slot ? slot.act : 'REST', staff: !!slot && slot.act === 'WORK' && slot.loc === b.id, age: LES.P.age(w, p) });
    }
    return out;
  };

  // Which visitor places someone uses, by what they came for and the kind of place.
  const VISIT = {
    learn: ['student', 'bench', 'table', 'wait', 'stand'], office: ['front', 'wait', 'table', 'stand'], shop: ['browse', 'front', 'stand'],
    food: ['table', 'front', 'stand'], health: ['wait', 'front', 'stand'],
  };
  const STAFF = { learn: ['teach', 'desk', 'counter', 'stand'], office: ['desk', 'counter', 'table', 'stand'], shop: ['counter', 'stand'], food: ['counter', 'stand'], health: ['nurse', 'desk', 'counter', 'stand'] };

  // Put people in their places, the followed person and their circle first; returns { people, more }.
  R.placePublic = function (w, plan, scene, followId, now) {
    const free = {}; for (const k in plan.spots) free[k] = Array.isArray(plan.spots[k]) ? plan.spots[k].slice() : [];
    const me = followId >= 0 ? w.people[followId] : null;
    const close = p => (me ? (p.id === me.id ? 0 : (me.parents || []).includes(p.id) || (me.children || []).includes(p.id) || me.partnerId === p.id ? 1 : me.job && p.job && me.job.biz === p.job.biz ? 2 : 3) : 3);
    const list = scene.slice().sort((a, c) => close(a.p) - close(c.p) || hash(a.p.id, 3) - hash(c.p.id, 3));
    const tick = Math.floor((now || 0) / 650), out = [];
    let more = 0, standing = 0; // at most four people stand about; the rest are counted in "+N"
    for (const s of list) {
      let order = s.staff ? STAFF[plan.group] : VISIT[plan.group];
      if (!s.staff && plan.group === 'health' && (s.p.health < 40 || hash(s.p.id, w.lastDay) < 0.4)) order = ['bed'].concat(order); // the sick lie in a bed
      if (!s.staff && plan.group === 'learn' && !['SCHOOL', 'STUDY', 'ENROLL'].includes(s.act)) order = ['table', 'stand'];
      let got = null;
      for (const k of order) { const l = free[k]; if (k === 'stand' && standing >= 4) continue; if (l && l.length) { if (k === 'stand') standing++; got = { spot: k === 'stand' ? l.splice(Math.floor(hash(s.p.id, 5) * l.length), 1)[0] : l.shift(), kind: k }; break; } }
      if (!got) { more++; continue; }
      const g = s.age < 3 ? 'baby' : s.age < 13 ? 'child' : 'adult', f = (tick + s.p.id) % 2;
      let pose = got.spot.pose;
      if (g === 'child' && pose === 'sitback' && hash(s.p.id, w.lastDay, Math.floor(tick / 6)) < 0.25) pose = 'hand'; // a hand up in class
      if (g === 'child' && (pose === 'watch' || pose === 'type')) pose = 'sitback';
      if (g === 'child' && ['serve', 'talk'].includes(pose)) pose = 'stand';
      let frame = g === 'baby' ? 'person.baby.sit' : `person.${g}.${pose}${pose === 'stand' || pose === 'bed' ? '' : `.${f}`}`;
      if (!A().has(frame)) frame = `person.${g}.${pose}.0`;
      if (!A().has(frame)) frame = `person.${g}.stand`;
      const name = s.slot && LES.Ambience && LES.Ambience.outfitFor ? LES.Ambience.outfitFor(s.p, s.slot) : null, def = name && LES.OUTFITS ? LES.OUTFITS[name] : null;
      const of = typeof def === 'function' ? def(s.p.look) : def;
      out.push({ p: s.p, s: { elder: s.age >= 65 }, act: pose, kind: got.kind, frame, x: got.spot.x, y: got.spot.y, key: got.spot.key, view: got.spot.view || 'front', uniform: of && of.shirt ? { shirt: of.shirt, pants: of.pants || s.p.look.pants } : null, staff: s.staff });
    }
    return { people: out, more };
  };

  R.drawPublic = function (r, g, tgt, t, now) {
    const w = r.w, b = tgt.b, name = R.publicPlanName(b), sig = `pub|${b.kind}|${name}`;
    if (!r._roomPlan || r._roomPlan.sig !== `${b.id}|${sig}`) r._roomPlan = { sig: `${b.id}|${sig}`, plan: R.planPublic(name) };
    const plan = r._roomPlan.plan, scene = R.publicScene(w, r, b, t), placed = R.placePublic(w, plan, scene, r.selectedId, now);
    return R._render(r, g, b, plan, sig, placed.people, scene, t, now, placed.more);
  };
})(globalThis.LES = globalThis.LES || {});
