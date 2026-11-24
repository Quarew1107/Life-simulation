// Inside public buildings (art upgrade Phase 5): schools, colleges and libraries; offices, banks and the stock
// exchange; shops, food courts and cafes; hospitals, clinics and the welfare office (5A); factories, workshops,
// warehouses and the bus depot; the police station, court, jail, prison and rehab centre; mosques, temples,
// churches, the community hall and the memorial; cinemas, bowling, karaoke, pubs and bars, gyms, spas and
// lounges (5B). One room of the building is shown, 14 x 9 tiles, one of three plans fixed per building. Only real
// people are in it: those whose position is inside this building now. Someone whose activity slot is WORK here is
// staff (at the counter, desk, machine or board, in uniform); everyone else is a visitor (pupils, customers,
// patients, worshippers, inmates, players). Drawing only: the world is read, never changed, no world dice used.
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
    factory: ['##W#####W####W', 'RR..RR..RR....', '..............', '.ZZZ...ZZZ....', '..............', '.UU..UU..UU...', '..............', 'x..x.....FF.t.', '------E-------'],
    workshop: ['##W####N###W##', '..............', '.LLL....LLL...', '.LLL....LLL...', '..............', '.nn..nn....o..', '..............', 'o.c........t..', '------E-------'],
    warehouse: ['##W######W####', 'RR.RR.RR.RR...', '..............', 'RR.RR.RR.RR...', '..............', '.xx.x....FF...', '..............', 'x.x.x......t..', '------E-------'],
    depot: ['##W######W####', '..............', '.BBB....BBB...', '.BBB....BBB...', '..............', '.nn..o.o..c...', '..............', 'RR.........t..', '------E-------'],
    police: ['##W###N####W##', '..KKK.........', '..............', '.OO.OO........', '..............', '.....CC..CC...', '..............', 'g..........LL.', '------E-------'],
    court: ['##W########W##', '....JJJ..w....', '..............', '.PPP..PPP.....', '..............', '.PPP..PPP.....', '..............', '...........LL.', '------E-------'],
    cells: ['##W#######W###', 'CC.CC.CC.CC...', '..............', '.b.b..TT..b.b.', '.b.b......b.b.', '..............', '..TT...TT.....', 'g...........LL', '------E-------'],
    rehab: ['##W###N####W##', '..............', '.QQ....QQ.....', '.QQ....QQ.....', '.....YY.......', '..............', 'b.b.b.........', 'b.b.b......LL.', '------E-------'],
    mosque: ['#####W#M#W####', '.......r......', '..............', '.p.p.p.p.p.p..', '..............', '.p.p.p.p.p.p..', '..............', '.p.p.p.p.p.p..', '------E-------'],
    temple_cn: ['##W###l####W##', '....AAA.......', '..............', '..............', '..c.......c...', '..............', '..............', '..............', '------E-------'],
    temple_hindu: ['##W########W##', '.....SS.......', '.....SS.......', '..............', '..c.......c...', '..............', '..............', '..............', '------E-------'],
    church: ['##W###c####W##', '.....AA.......', '..............', '.PPP...PPP....', '..............', '.PPP...PPP....', '..............', 'c..........c..', '------E-------'],
    hall: ['##W########W##', '....sss.......', '....sss.......', '..............', '.TTT...TTT....', '..............', '.TTT...TTT....', '..............', '------E-------'],
    memorial: ['##W###c####W##', '....kk........', '....kk........', '..............', '.PPP...PPP....', '..............', '.PPP...PPP....', 'c..........c..', '------E-------'],
    cinema: ['##W###V####W##', '..............', '..............', '.SSS.SSS.SSS..', '..............', '.SSS.SSS.SSS..', '..............', '.SSS.SSS......', '------E-------'],
    bowling: ['##W########W##', '.L.L.L.L.L.L..', '.L.L.L.L.L.L..', '.L.L.L.L.L.L..', '..............', 'bb....bb......', '..............', '.hhh....hhh...', '------E-------'],
    karaoke: ['##W########W##', '.KKK....KKK...', '.KKK....KKK...', '..............', '..m.......m...', '..............', '.BBB...TT..TT.', '..............', '------E-------'],
    pub: ['##W###o####W##', '....BBB.......', '..............', '.TT..TT..TT...', '..............', '.TT..TT..TT...', '..............', '..............', '------E-------'],
    gym: ['##W########W##', '.RR.RR.RR.RR..', '..............', '.WW..WW..WW...', '..............', '.dd.....dd....', '..............', '..............', '------E-------'],
    spa: ['##W########W##', '..............', '.MM...MM...MM.', '..............', '..............', '.MM...MM......', '..............', '..........KKK.', '------E-------'],
  };
  const mirror = rows => rows.map(r => [...r].reverse().join(''));
  // Which plans each kind of building uses (three, fixed per building); ':m' = mirrored, ':black' = blackboard.
  const KIND_PLANS = {
    school: ['class', 'class:black', 'lab'], privschool: ['class', 'lab', 'class:black'], kolej: ['lecture', 'lab', 'library'], university: ['lecture', 'lab', 'library'],
    library: ['library', 'library:m', 'library'],
    office: ['open', 'open:m', 'trade'], hq: ['open', 'open:m', 'trade'], townhall: ['open', 'open:m', 'open'], researchcentre: ['lab', 'open', 'lab:m'],
    bank: ['bank', 'bank:m', 'bank'], bursa: ['trade', 'trade:m', 'open'], techhub: ['trade', 'open', 'trade:m'],
    shoplot: ['shop', 'shop:m', 'shop'], mall: ['shop', 'shop:m', 'food'], hawker: ['food', 'food:m', 'food'], mamak: ['cafe', 'cafe:m', 'cafe'], finedine: ['cafe', 'cafe:m', 'cafe'],
    hospital: ['ward', 'clinic', 'ward:m'], privhosp: ['ward', 'clinic', 'clinic:m'], welfare: ['welfare', 'welfare:m', 'clinic'],
    factory: ['factory', 'factory:m', 'warehouse'], workshop: ['workshop', 'workshop:m', 'workshop'], warehouse: ['warehouse', 'warehouse:m', 'factory'], depot: ['depot', 'depot:m', 'workshop'],
    police: ['police', 'police:m', 'police'], court: ['court', 'court:m', 'court'], jail: ['cells', 'cells:m', 'police'], prison: ['cells', 'cells:m', 'cells'], rehab: ['rehab', 'rehab:m', 'rehab'],
    masjid: ['mosque', 'mosque:m', 'mosque'], tokong: ['temple_cn', 'temple_cn:m', 'temple_cn'], kuil: ['temple_hindu', 'temple_hindu:m', 'temple_hindu'], gereja: ['church', 'church:m', 'church'],
    hall: ['hall', 'hall:m', 'hall'], memorial: ['memorial', 'memorial:m', 'memorial'],
    cinema: ['cinema', 'cinema:m', 'cinema'], bowling: ['bowling', 'bowling:m', 'bowling'], karaoke: ['karaoke', 'karaoke:m', 'karaoke'], lounge: ['pub', 'pub:m', 'pub'],
    gym: ['gym', 'gym:m', 'gym'], spa: ['spa', 'spa:m', 'spa'],
  };
  const GROUP = {
    class: 'learn', lab: 'learn', lecture: 'learn', library: 'learn', open: 'office', bank: 'office', trade: 'office', shop: 'shop', food: 'food', cafe: 'food', ward: 'health', clinic: 'health', welfare: 'health',
    factory: 'industry', workshop: 'industry', warehouse: 'industry', depot: 'industry', police: 'justice', court: 'justice', cells: 'justice', rehab: 'justice',
    mosque: 'worship', temple_cn: 'worship', temple_hindu: 'worship', church: 'worship', hall: 'worship', memorial: 'worship',
    cinema: 'leisure', bowling: 'leisure', karaoke: 'leisure', pub: 'leisure', gym: 'leisure', spa: 'leisure',
  };
  // Floors and walls by plan (or by group).
  const LOOK = {
    learn: ['pub.floor.class', 'pub.wall.cream'], library: ['pub.floor.wood', 'pub.wall.cream'], office: ['pub.floor.office', 'pub.wall.grey'], shop: ['pub.floor.shop', 'pub.wall.shop'],
    food: ['pub.floor.terrazzo', 'pub.wall.cream'], cafe: ['pub.floor.wood', 'pub.wall.cream'], health: ['pub.floor.hospital', 'pub.wall.green'],
    industry: ['pub.floor.factory', 'pub.wall.metal'], workshop: ['pub.floor.workshop', 'pub.wall.metal'], depot: ['pub.floor.workshop', 'pub.wall.concrete'],
    justice: ['pub.floor.cell', 'pub.wall.concrete'], police: ['pub.floor.office', 'pub.wall.grey'], court: ['pub.floor.court', 'pub.wall.woodpanel'], rehab: ['pub.floor.class', 'pub.wall.cream'],
    mosque: ['pub.floor.prayer', 'pub.wall.cream'], temple_cn: ['pub.floor.temple', 'pub.wall.red'], temple_hindu: ['pub.floor.temple', 'pub.wall.cream'], church: ['pub.floor.wood', 'pub.wall.cream'],
    hall: ['pub.floor.wood', 'pub.wall.cream'], memorial: ['pub.floor.temple', 'pub.wall.cream'],
    cinema: ['pub.floor.cinema', 'pub.wall.woodpanel'], bowling: ['pub.floor.wood', 'pub.wall.woodpanel'], karaoke: ['pub.floor.cinema', 'pub.wall.woodpanel'], pub: ['pub.floor.wood', 'pub.wall.woodpanel'],
    gym: ['pub.floor.gym', 'pub.wall.grey'], spa: ['pub.floor.wood', 'pub.wall.cream'],
  };
  // What each letter of a plan is: [sprite, role, pose]. Roles: teach (staff by the board or altar), counter (staff
  // behind, customers in front), desk (staff seat), work (staff in front of a machine), line (staff behind a belt),
  // student (pupil's desk), bench (seat behind a bench), table (seats), wait (row of chairs), audience (seats facing
  // the screen or altar), bed, browse, cell (behind bars), bunk, circle (chairs in a ring), altar (worshippers in
  // front), pray (a prayer mat), lane, sing, run, lift, massage, decor.
  const LEGEND = {
    A: ['pub.teacher_desk', 'desk', 'write'], a: ['pub.student_desk', 'student'], B: ['pub.lab_bench', 'bench'], P: ['pub.podium', 'teach'], L: ['pub.lockers', 'decor'], g: ['pub.globe', 'decor'],
    S: ['pub.shelf.0', 'browse'], s: ['pub.shelf.1', 'browse'], G: ['pub.reading_table', 'table', 'write'], K: ['pub.reception', 'counter'],
    O: ['pub.office_desk', 'desk', 'type'], f: ['pub.filing', 'decor'], p: ['pub.office_plant', 'decor'], w: ['pub.cooler', 'decor'], r: ['pub.server', 'decor'], t: ['pub.atm', 'browse'], h: ['pub.wait_chairs', 'wait'],
    R: ['pub.clothes', 'browse'], F: ['pub.drinks', 'browse'], b: ['pub.baskets', 'decor'], Q: ['pub.stall', 'counter'], Y: ['pub.roti', 'counter'], T: ['pub.rest_table', 'table', 'eat'], C: ['pub.coffee', 'counter'],
    H: ['pub.hosp_bed', 'bed'], c: ['pub.curtain', 'decor'], i: ['pub.iv', 'decor'], m: ['pub.med_cabinet', 'decor'], u: ['pub.couch', 'decor'], J: ['pub.welfare_counter', 'counter'],
  };
  const BY_PLAN = {
    library: { K: ['pub.reception', 'counter'] }, open: { G: ['pub.meeting_table', 'table', 'write'], K: ['pub.reception', 'counter'] }, trade: { G: ['pub.meeting_table', 'table', 'write'] },
    bank: { B: ['pub.bank_counter', 'counter'] }, shop: { K: ['pub.checkout', 'counter'] }, food: { G: ['pub.court_table', 'table', 'eat'] }, cafe: { K: ['pub.checkout', 'counter'] },
    clinic: { K: ['pub.hosp_reception', 'counter'], O: ['pub.doctor_desk', 'desk', 'type'], w: ['pub.wheelchair', 'decor'] }, ward: { w: ['pub.wheelchair', 'decor'] }, welfare: { Y: ['pub.play_mat', 'decor'] },
    factory: { R: ['pub.rack', 'decor'], Z: ['pub.conveyor', 'line'], U: ['pub.machine', 'work', 'repair'], x: ['pub.crates', 'decor'], F: ['pub.forklift', 'decor'], t: ['pub.control', 'work', 'stand'] },
    workshop: { L: ['pub.car_lift', 'work', 'repair'], n: ['pub.workbench', 'work', 'repair'], o: ['pub.tyres', 'decor'], c: ['pub.cone', 'decor'], t: ['pub.control', 'decor'] },
    warehouse: { R: ['pub.rack', 'work', 'carry'], x: ['pub.crates', 'decor'], F: ['pub.forklift', 'decor'], t: ['pub.control', 'decor'] },
    depot: { B: ['pub.bus_repair', 'work', 'repair'], n: ['pub.workbench', 'work', 'repair'], o: ['pub.tyres', 'decor'], c: ['pub.cone', 'decor'], R: ['pub.rack', 'decor'], t: ['pub.control', 'decor'] },
    police: { K: ['pub.police_desk', 'counter'], C: ['pub.cell', 'cell'], g: ['pub.gate', 'decor'], L: ['pub.lockers_grey', 'decor'] },
    court: { J: ['pub.judge', 'desk', 'write'], w: ['pub.witness', 'teach'], P: ['pub.court_bench', 'audience'], L: ['pub.lockers_grey', 'decor'] },
    cells: { C: ['pub.cell', 'cell'], b: ['pub.bunk', 'bunk'], T: ['pub.steel_table', 'table', 'eat'], g: ['pub.gate', 'decor'], L: ['pub.lockers_grey', 'decor'] },
    rehab: { Q: ['pub.circle', 'circle'], Y: ['pub.counsel', 'table', 'write'], b: ['pub.bunk', 'bunk'], L: ['pub.lockers_grey', 'decor'] },
    mosque: { p: ['pub.sejadah', 'pray'], r: ['pub.rehal', 'decor'] },
    temple_cn: { A: ['pub.altar_cn', 'altar'], c: ['pub.candles', 'decor'] }, temple_hindu: { S: ['pub.shrine_hindu', 'altar'], c: ['pub.candles', 'decor'] },
    church: { A: ['pub.altar_church', 'altar'], P: ['pub.pew', 'audience'], c: ['pub.candles', 'decor'] },
    hall: { s: ['pub.stage', 'teach'], T: ['pub.hall_table', 'table', 'eat'] }, memorial: { k: ['pub.wreath', 'altar'], P: ['pub.pew', 'audience'], c: ['pub.candles', 'decor'] },
    cinema: { S: ['pub.cinema_seats', 'audience'] }, bowling: { L: ['pub.lane', 'lane'], b: ['pub.ball_rack', 'decor'] },
    karaoke: { K: ['pub.karaoke', 'sing'], m: ['pub.mic', 'decor'], B: ['pub.bar', 'counter'], T: ['pub.rest_table', 'table', 'eat'] },
    pub: { B: ['pub.bar', 'counter'], T: ['pub.rest_table', 'table', 'eat'] },
    gym: { R: ['pub.treadmill', 'run'], W: ['pub.weights', 'lift'], d: ['pub.dumbbells', 'decor'] }, spa: { M: ['pub.massage_bed', 'massage'], K: ['pub.reception', 'counter'] },
  };
  // Country pieces: the mamak is a cafe, a diner or a noodle shop; the karaoke place a pub (UK) or a bar (US).
  const COUNTRY = {
    cafe: { my: { Y: ['my.tehtarik', 'counter'], T: ['my.mamak_table', 'table', 'eat'] }, us: { Y: ['us.diner_counter', 'counter'], T: ['us.booth', 'table', 'eat'] }, cn: { Y: ['cn.noodle_counter', 'counter'], T: ['cn.round_table', 'table', 'eat'] } },
    pub: { uk: { B: ['uk.pub_bar', 'counter'], T: ['uk.pub_table', 'table', 'eat'] }, us: { T: ['us.booth', 'table', 'eat'] } },
  };
  const KARAOKE = { uk: 'pub', us: 'pub' }; // the karaoke kind is a pub in the UK and a bar in the USA
  const WALL = { class: 'pub.whiteboard', 'class:black': 'pub.blackboard', lecture: 'pub.screen', trade: 'pub.trading', food: 'pub.menu', cafe: 'pub.menu', clinic: 'pub.number', welfare: 'pub.number' };
  const WALL_LETTER = { N: { police: 'pub.notice', workshop: 'pub.toolboard', rehab: 'pub.notice' }, M: 'pub.mihrab', l: 'pub.lanterns', c: 'pub.candles', V: { cinema: 'pub.cinema_screen' }, o: 'pub.bottles' };

  R.publicGroup = b => (b && KIND_PLANS[b.kind] && R.available() && A().has('pub.floor.class') ? GROUP[KIND_PLANS[b.kind][0].split(':')[0]] : null);
  R.publicPlanName = (b, country) => {
    let name = KIND_PLANS[b.kind][Math.floor(hash(b.id, 11) * 3)];
    if (b.kind === 'karaoke' && KARAOKE[country]) name = 'pub' + (name.endsWith(':m') ? ':m' : '');
    return name;
  };

  // The plan of one public room: furniture, the staff places and the visitor places.
  R.planPublic = function (name, country) {
    const [base, opt] = name.split(':'), raw = R.PUBLIC_PLANS[base], rows = opt === 'm' ? mirror(raw) : raw, group = GROUP[base];
    const cols = rows[0].length, W = cols * TS, H = 16 + rows.length * TS, items = [], art = A();
    const spots = { teach: [], counter: [], desk: [], nurse: [], work: [], line: [], student: [], bench: [], table: [], wait: [], audience: [], bed: [], browse: [], front: [], cell: [], bunk: [], circle: [], altar: [], pray: [], lane: [], sing: [], run: [], lift: [], massage: [], stand: [], lamp: [], flame: null };
    const add = (id, cx, bottom, extra) => { const [w, h] = art.size(id); const it = Object.assign({ id, x: Math.round(cx - w / 2), y: bottom - h, w, h, key: bottom }, extra || {}); items.push(it); return it; };
    const legend = Object.assign({}, LEGEND, BY_PLAN[base] || {}, (COUNTRY[base] || {})[country] || {});
    for (let c = 0; c < cols; c++) { // the board, screen, menu, mihrab or notice board on the back wall
      const ch = rows[0][c];
      if ('#W'.includes(ch)) continue;
      const map = WALL_LETTER[ch], id = typeof map === 'string' ? map : map && map[base] ? map[base] : WALL[opt === 'black' ? 'class:black' : base] || 'pub.whiteboard', [w, h] = art.size(id);
      items.push({ id, x: c * TS + 8 - Math.round(w / 2), y: Math.max(1, 30 - h), w, h, key: -1, wall: true });
      if ((group === 'learn' && base !== 'library') || base === 'mosque') spots.teach.push({ x: c * TS + 8, y: top(2) + 12, key: top(2) + 12, pose: base === 'mosque' ? 'pray' : 'talk' });
    }
    for (const q of R._rects(rows, Object.keys(legend).join(''))) {
      const L = legend[q.ch];
      if (!L) continue;
      const cx = (q.c0 + q.c1 + 1) * TS / 2, bottom = top(q.r1 + 1), it = add(L[0], cx, bottom), role = L[1];
      if (role === 'counter') { spots.counter.push({ x: cx, y: it.y + 12, key: it.key - 1, pose: 'serve' }); for (const dx of [-9, 9]) spots.front.push({ x: cx + dx, y: bottom + 14, key: bottom + 14, pose: 'stand' }); }
      else if (role === 'desk') spots.desk.push({ x: cx, y: it.y + 9, key: it.key - 1, pose: L[2] || 'type' });
      else if (role === 'teach') spots.teach.push({ x: cx, y: it.y + 12, key: it.key - 1, pose: base === 'hall' ? 'sing' : 'talk' });
      else if (role === 'work') spots.work.push({ x: cx, y: bottom + 12, key: bottom + 12, pose: L[2] || 'repair', view: 'back' });
      else if (role === 'line') for (const dx of [-12, 12]) spots.line.push({ x: cx + dx, y: it.y + 10, key: it.key - 1, pose: 'serve' });
      else if (role === 'student') spots.student.push({ x: cx, y: it.key - 1, key: it.key + 0.5, pose: base === 'lecture' ? 'watch' : 'sitback' });
      else if (role === 'bench') spots.bench.push({ x: cx, y: it.y + 9, key: it.key - 1, pose: 'write' });
      else if (role === 'table') { spots.table.push({ x: it.x + 7, y: it.y + 9, key: it.key - 1, pose: L[2] }, { x: it.x + it.w - 7, y: it.y + 9, key: it.key - 1, pose: L[2] }); }
      else if (role === 'wait') for (let k = 0; k < 3; k++) spots.wait.push({ x: it.x + 8 + k * Math.round((it.w - 16) / 2), y: it.key - 3, key: it.key + 0.5, pose: 'sofa' });
      else if (role === 'audience') for (let k = 0; k < 3; k++) spots.audience.push({ x: it.x + 8 + k * Math.round((it.w - 16) / 2), y: it.key - 1, key: it.key + 0.5, pose: 'watch' });
      else if (role === 'bed') { spots.bed.push({ x: cx, y: it.y + 4, key: it.key + 0.5, pose: 'bed', view: 'top' }); spots.nurse.push({ x: cx + 14, y: it.key - 2, key: it.key, pose: 'talk' }); }
      else if (role === 'massage') { spots.massage.push({ x: cx, y: it.y + 3, key: it.key + 0.5, pose: 'bed', view: 'top' }); spots.nurse.push({ x: cx + 20, y: it.key - 1, key: it.key, pose: 'stand' }); }
      else if (role === 'browse') spots.browse.push({ x: cx, y: bottom + 14, key: bottom + 14, pose: 'stand' });
      else if (role === 'cell') spots.cell.push({ x: cx, y: it.y + 22, key: it.key - 1, pose: 'stand' }); // behind the bars
      else if (role === 'bunk') for (const dy of [2, 16]) spots.bunk.push({ x: cx, y: it.y + dy, key: it.key + 0.5, pose: 'bed', view: 'top' });
      else if (role === 'circle') for (const [dx, dy] of [[-9, -6], [9, -6], [-9, 8], [9, 8]]) spots.circle.push({ x: cx + dx, y: it.y + 16 + dy + 8, key: it.y + 16 + dy + 8, pose: 'sofa' });
      else if (role === 'altar') for (const dx of [-14, 0, 14]) spots.altar.push({ x: cx + dx, y: bottom + 16, key: bottom + 16, pose: 'praystand', view: 'back' });
      else if (role === 'pray') spots.pray.push({ x: cx, y: it.key - 2, key: it.key, pose: 'pray' });
      else if (role === 'lane') spots.lane.push({ x: cx, y: bottom + 12, key: bottom + 12, pose: 'bowl' });
      else if (role === 'sing') { spots.sing.push({ x: cx, y: bottom + 12, key: bottom + 12, pose: 'sing' }); for (const dx of [-12, 12]) spots.sing.push({ x: cx + dx, y: it.key - 4, key: it.key + 0.5, pose: 'sofa' }); }
      else if (role === 'run') spots.run.push({ x: cx, y: it.key - 3, key: it.key + 0.5, pose: 'run' });
      else if (role === 'lift') spots.lift.push({ x: cx, y: it.key - 2, key: it.key + 0.5, pose: 'lift' });
    }
    const used = (x, y) => items.some(it => !it.wall && x >= it.x - 3 && x <= it.x + it.w + 3 && y >= it.y && y <= it.key + 6);
    for (let r = 2; r < rows.length - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const x = c * TS + 8, y = top(r) + 14;
      if (rows[r][c] === '.' && !used(x, y)) spots.stand.push({ x, y, key: y, pose: 'stand' });
    }
    const [floor, wall] = LOOK[base] || LOOK[group];
    const look = { floor: [floor], floorKitchen: [floor], wall: [wall], wallKitchen: wall, window: [`${country || 'my'}.window`, `${country || 'my'}.window_curtain`], extras: [] };
    return { rows, items, spots, W, H, look, group, name, base };
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

  // Which places someone uses, by what they came for and the kind of place.
  const VISIT = {
    learn: ['student', 'bench', 'table', 'wait', 'stand'], office: ['front', 'wait', 'table', 'stand'], shop: ['browse', 'front', 'stand'],
    food: ['table', 'front', 'stand'], health: ['wait', 'front', 'stand'], industry: ['stand'],
    justice: ['audience', 'wait', 'front', 'circle', 'table', 'stand'], worship: ['pray', 'altar', 'audience', 'table', 'stand'],
    leisure: ['audience', 'lane', 'sing', 'run', 'lift', 'massage', 'table', 'front', 'wait', 'stand'],
  };
  const STAFF = {
    learn: ['teach', 'desk', 'counter', 'stand'], office: ['desk', 'counter', 'table', 'stand'], shop: ['counter', 'stand'], food: ['counter', 'stand'], health: ['nurse', 'desk', 'counter', 'stand'],
    industry: ['work', 'line', 'stand'], justice: ['counter', 'desk', 'teach', 'stand'], worship: ['teach', 'stand'], leisure: ['counter', 'nurse', 'stand'],
  };

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
      if (!s.staff && plan.group === 'justice' && (s.p.inst || s.act === 'PRISON')) order = plan.base === 'rehab' ? ['circle', 'table', 'bunk', 'stand'] : ['cell', 'table', 'bunk', 'stand'];
      if (!s.staff && plan.base === 'mosque' && s.p.rel !== 'islam') order = ['stand'];
      let got = null;
      for (const k of order) { const l = free[k]; if (k === 'stand' && standing >= 4) continue; if (l && l.length) { if (k === 'stand') standing++; got = { spot: k === 'stand' ? l.splice(Math.floor(hash(s.p.id, 5) * l.length), 1)[0] : l.shift(), kind: k }; break; } }
      if (!got) { more++; continue; }
      const g = s.age < 3 ? 'baby' : s.age < 13 ? 'child' : 'adult', f = (tick + s.p.id) % 2;
      let pose = got.spot.pose;
      if (g === 'child' && pose === 'sitback' && hash(s.p.id, w.lastDay, Math.floor(tick / 6)) < 0.25) pose = 'hand'; // a hand up in class
      if (g === 'child' && ['watch', 'type'].includes(pose)) pose = 'sitback';
      if (g === 'child' && ['serve', 'talk', 'repair', 'carry', 'sing', 'bowl', 'run', 'lift'].includes(pose)) pose = pose === 'bowl' || pose === 'sing' ? 'cheer' : 'stand';
      let frame = g === 'baby' ? 'person.baby.sit' : `person.${g}.${pose}${pose === 'stand' || pose === 'bed' ? '' : `.${f}`}`;
      if (!A().has(frame)) frame = `person.${g}.${pose}.0`;
      if (!A().has(frame)) frame = `person.${g}.stand`;
      const name = s.slot && LES.Ambience && LES.Ambience.outfitFor ? LES.Ambience.outfitFor(s.p, s.slot) : null, def = name && LES.OUTFITS ? LES.OUTFITS[name] : null;
      const of = typeof def === 'function' ? def(s.p.look) : def;
      out.push({ p: s.p, s: { elder: s.age >= 65 }, act: pose, kind: got.kind, frame, x: got.spot.x, y: got.spot.y, key: got.spot.key, view: got.spot.view === 'top' ? 'top' : 'front', uniform: of && of.shirt ? { shirt: of.shirt, pants: of.pants || s.p.look.pants } : null, staff: s.staff });
    }
    return { people: out, more };
  };

  R.drawPublic = function (r, g, tgt, t, now) {
    const w = r.w, b = tgt.b, country = (w.cfg && w.cfg.country) || 'my', name = R.publicPlanName(b, country), sig = `pub|${b.kind}|${name}|${country}`;
    if (!r._roomPlan || r._roomPlan.sig !== `${b.id}|${sig}`) r._roomPlan = { sig: `${b.id}|${sig}`, plan: R.planPublic(name, country) };
    const plan = r._roomPlan.plan, scene = R.publicScene(w, r, b, t), placed = R.placePublic(w, plan, scene, r.selectedId, now);
    return R._render(r, g, b, plan, sig, placed.people, scene, t, now, placed.more);
  };
})(globalThis.LES = globalThis.LES || {});
