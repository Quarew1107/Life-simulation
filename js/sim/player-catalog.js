// Play a Life, PL-13: the wider catalogue of life moments (Idea/Life simulation expansion/ALL_EVENTS_REVIEW.md).
// Each event offers 3 choices. A choice is either a real request (the same commands as everywhere: the carer,
// employer, partner... decides) or the character's own reaction, which has a small genuine effect on them
// (`fx`, below) and nothing more: no money, no invented success. Events whose situation cannot be backed by the
// engine are revised to a situation that can (noted where it matters).
//
// fx profiles: a few points of stress / happiness / energy, or, for children, a small step in the potential of
// one ability ("experiences", capped at +0.3 per ability for life, like clubs and schools; abilities are rebuilt
// from potential every year, so this is how childhood leaves a mark).
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  Pl.FX = {
    comfort: { stress: -3, happy: 2 }, calm: { stress: -2 }, joy: { happy: 3 }, rest: { energy: 8, stress: -1 }, brave: { happy: 1, learn: ['PER', 0.006] },
    learn: { learn: ['INT', 0.008] }, social: { happy: 1, learn: ['CHA', 0.008] }, active: { happy: 1, learn: ['AGI', 0.006] }, curious: { learn: ['PER', 0.008] },
    strong: { learn: ['STR', 0.006] }, steady: { stress: -1 }, upset: { stress: 2 }, proud: { happy: 4 }, focus: { learn: ['INT', 0.005], stress: 1 },
  };
  const EXP_MAX = 0.3;
  Pl.applyFx = function (w, p, name) {
    const f = Pl.FX[name];
    if (!f || !p || !p.alive) return;
    if (f.stress) p.stress = U.clamp(p.stress + f.stress, 0, 100);
    if (f.happy) p.happy = U.clamp(p.happy + f.happy, 0, 100);
    if (f.energy) p.energy = U.clamp(p.energy + f.energy, 0, 100);
    if (f.learn && !P.isAdult(w, p)) {
      const a = C[f.learn[0]], s = st(w), b = s.expBoost = s.expBoost || [0, 0, 0, 0, 0, 0];
      const nb = U.clamp(b[a] + f.learn[1], -EXP_MAX, EXP_MAX), real = nb - b[a];
      b[a] = nb; p.pot[a] = U.clamp(p.pot[a] + real, 0, 10);
    }
  };

  // A child asks to be taken to the clinic: the carer decides (as for a cuddle) and pays the clinic's real fee;
  // it helps when the child is unwell (+12 health below 90, as for anyone).
  Pl.HANDLERS.ASK_CLINIC = {
    hours: 2, cooldown: 30, maxAge: 11, key: () => 'clinic',
    check(w, p) { return p.guardian === 'WELFARE' ? 'welfare' : !Pl.carerOf(w, p) ? 'no_carer' : p.health >= 90 ? 'well' : null; },
    params(w, p) { const g = Pl.carerOf(w, p); return { carer: g ? P.name(g) : '' }; },
    run(w, p) {
      const g = Pl.carerOf(w, p), R = Pl.rng(w);
      const yes = U.clamp(0.45 + 0.45 * g.pers.resp / 100 + (p.health < 60 ? 0.2 : 0), 0.1, 0.97);
      if (R.next() >= yes || g.cash < w.px(60)) return { code: 'busy', params: { carer: P.name(g) } };
      const paid = w.gov ? LES.Services.medicalBill(w, g, w.px(60), true) >= 0 : w.ledger.spend(g, 'cash', 'HEALTH', w.px(60));
      if (!paid) return { code: 'busy', params: { carer: P.name(g) } };
      p.health = Math.min(100, p.health + 12); g.energy -= 4; st(w).played = true;
      return { code: 'ok', params: { carer: P.name(g) } };
    },
  };
  Pl.TARGETS.clinic = () => ({});

  // ---- Situations the catalogue needs ----
  const carer = (w, p) => Pl.carerOf(w, p);
  const month = w => U.dayToDate(w.day).month;
  Pl.rainySeason = w => { const m = month(w); return LES.Countries && LES.Countries.pack && LES.Countries.pack.code === 'my' ? [10, 11, 0, 1].includes(m) : [9, 10, 11, 0, 1, 2].includes(m); };
  Pl.festivalSoon = w => { for (let d = 0; d <= 21; d++) if (LES.Calendar.festival(w.day + d)) return LES.Calendar.festival(w.day + d); return null; };
  const grandparent = (w, p) => { const g = p.parents.flatMap(id => w.people[id].parents).map(id => w.people[id]).filter(q => q && q.alive && !q.away); return g.length ? g[(w.day / 30 | 0) % g.length] : null; };
  Pl.DAILY.push(function (w, p) { // a new home (for "a new home" moments)
    const s = st(w);
    if (!p || !p.alive) return;
    if (s.homeSeen !== undefined && s.homeSeen !== p.homeId) s.movedDay = w.day;
    s.homeSeen = p.homeId;
  });
  Object.assign(Pl.CONDITIONS, {
    always: () => true,
    rainy: w => Pl.rainySeason(w),
    festival: w => !!Pl.festivalSoon(w),
    grandparent: (w, p) => !!grandparent(w, p),
    moved: (w, p) => st(w).movedDay > w.day - 60,
    carerOut: (w, p) => { const g = carer(w, p); return !!g && (!!g.job || !!g.enrol); },
    notWell: (w, p) => p.health < 85 && !!carer(w, p),
    wellCared: (w, p) => !!carer(w, p) && p.health >= 60,
    familyNear: (w, p) => !!grandparent(w, p) || p.parents.some(id => w.people[id].children.length > 1),
  });
  Object.assign(Pl.PARAMS, {
    grandparent: (w, p) => { const q = grandparent(w, p), g = carer(w, p); return { other: q ? P.name(q) : '', carer: g ? P.name(g) : '' }; },
    festival: (w, p) => { const f = Pl.festivalSoon(w), g = carer(w, p); return { festival: f ? f.name : '', carer: g ? P.name(g) : '' }; },
  });

  // ---- Baby (0-2): 41 more moments; the baby reacts (fx), or asks the carer (ASK_CARE / ASK_CLINIC) ----
  const baby = (id, when, choices, o) => Object.assign({ id, stages: ['baby'], minAge: 0, maxAge: 2, when, chance: 0.2, cooldown: 99999, expires: 10, imp: 1, params: 'carer', choices }, o || {});
  const fx = (id, f) => ({ id, story: true, fx: f }), ask = id => ({ id, cmd: 'ASK_CARE', target: 'care' }), cry = id => ({ id, cmd: 'ASK_CARE', target: 'careLoud' }), clinic = id => ({ id, cmd: 'ASK_CLINIC', target: 'clinic' });
  Pl.EVENTS.push(
    baby('BA-001', 'hasCarer', [ask('reach'), fx('watch', 'curious'), fx('turn', 'curious')], { maxAge: 0 }),
    baby('BA-003', 'grandparent', [fx('smile', 'social'), fx('observe', 'calm'), ask('stay')], { params: 'grandparent', chance: 0.3 }),
    baby('BA-005', 'hasCarer', [ask('snuggle'), fx('down', 'active'), fx('toys', 'curious')], { cooldown: 300 }),
    baby('BA-007', 'familyNear', [fx('join', 'social'), ask('stay'), fx('rest', 'rest')], { params: 'festival' }),
    baby('BA-009', 'carerOut', [fx('ritual', 'brave'), cry('hold'), fx('toy', 'calm')], { minAge: 1 }),
    baby('BA-011', 'wellCared', [fx('toy', 'comfort'), ask('contact'), fx('song', 'joy')], { maxAge: 1, chance: 0.15 }),
    baby('BA-013', 'hasCarer', [fx('taste', 'brave'), fx('refuse', 'steady'), ask('familiar')], { minAge: 0.5 }),
    baby('BA-014', 'hasCarer', [ask('rest'), fx('gentle', 'calm'), cry('signal')], { cooldown: 240 }),
    baby('BA-015', 'wellCared', [fx('follow', 'brave'), ask('hand'), fx('watch', 'curious')], { minAge: 1 }),
    baby('BA-016', 'rainy', [ask('reassure'), fx('window', 'curious'), fx('comfort', 'comfort')], { cooldown: 365 }),
    baby('BA-017', 'notWell', [clinic('rest'), ask('fluids'), cry('help')], { chance: 0.5, cooldown: 120, imp: 2 }),
    baby('BA-018', 'hasCarer', [fx('familiar', 'steady'), fx('change', 'brave'), ask('reassure')]),
    baby('BA-019', 'festival', [fx('quiet', 'rest'), fx('join', 'social'), ask('adult')], { params: 'festival' }),
    baby('BA-020', 'hasCarer', [fx('walk', 'active'), fx('remove', 'steady'), fx('observe', 'curious')], { minAge: 1 }),
    baby('BA-021', 'hasCarer', [fx('toy', 'active'), ask('follow'), fx('texture', 'curious')], { maxAge: 1 }),
    baby('BA-022', 'hasCarer', [ask('hand'), fx('furniture', 'strong'), fx('rest', 'rest')], { minAge: 0.8 }),
    baby('BA-024', 'hasCarer', [fx('animals', 'learn'), fx('vehicles', 'learn'), ask('repeat')], { minAge: 1 }),
    baby('BA-025', 'always', [fx('match', 'learn'), fx('stack', 'active'), ask('help')], { minAge: 1.5 }),
    baby('BA-026', 'hasCarer', [fx('hug', 'social'), fx('name', 'learn'), fx('quiet', 'calm')], { minAge: 1.5 }),
    baby('BA-027', 'hasCarer', [fx('count', 'learn'), fx('clap', 'joy'), fx('watch', 'curious')], { minAge: 2 }),
    baby('BA-028', 'always', [fx('alone', 'focus'), ask('hints'), fx('easier', 'joy')], { minAge: 2 }),
    baby('BA-029', 'hasCarer', [fx('home', 'learn'), fx('local', 'social'), fx('listen', 'curious')], { minAge: 1.5 }),
    baby('BA-030', 'hasCarer', [fx('home', 'learn'), fx('park', 'curious'), ask('carry')], { minAge: 2 }),
    baby('BA-031', 'toddlerNear', [fx('turn', 'social'), fx('back', 'upset'), fx('another', 'calm')], { minAge: 1, params: 'toddler' }),
    baby('BA-033', 'rainy', [fx('draw', 'curious'), fx('tower', 'active'), fx('music', 'joy')], { minAge: 1, cooldown: 365 }),
    baby('BA-034', 'hasCarer', [fx('slide', 'brave'), fx('sand', 'curious'), fx('watch', 'social')], { minAge: 1 }),
    baby('BA-035', 'hasCarer', [ask('help'), fx('recover', 'steady'), fx('again', 'brave')], { minAge: 1, cooldown: 240 }),
    baby('BA-036', 'always', [fx('cook', 'curious'), fx('serve', 'social'), fx('watch', 'calm')], { minAge: 2 }),
    baby('BA-037', 'toddlerNear', [fx('turns', 'social'), fx('move', 'calm'), ask('adult')], { minAge: 1.5, params: 'toddler' }),
    baby('BA-038', 'always', [fx('roll', 'active'), fx('toss', 'strong'), fx('chase', 'active')], { minAge: 1.5 }),
    baby('BA-039', 'always', [fx('observe', 'curious'), fx('touch', 'joy'), fx('distance', 'steady')], { minAge: 1 }),
    baby('BA-040', 'always', [fx('insects', 'curious'), fx('water', 'learn'), fx('leaves', 'active')], { minAge: 1 }),
    baby('BA-041', 'moved', [fx('explore', 'brave'), ask('close'), fx('belongings', 'comfort')], { chance: 0.9, cooldown: 300, imp: 2 }),
    baby('BA-042', 'festival', [fx('lanterns', 'joy'), fx('music', 'social'), fx('quiet', 'rest')], { params: 'festival', cooldown: 300 }),
    baby('BA-043', 'hasCarer', [fx('fruit', 'learn'), fx('vendors', 'curious'), ask('leave')], { minAge: 1 }),
    baby('BA-045', 'carerOut', [fx('table', 'curious'), fx('child', 'social'), ask('hand')], { minAge: 1.5, imp: 2, chance: 0.3 }),
    baby('BA-046', 'toddlerNear', [fx('toy', 'social'), fx('watch', 'calm'), fx('wave', 'joy')], { minAge: 1.5, params: 'toddler' }),
    baby('BA-047', 'carerOut', [fx('imitate', 'learn'), fx('elsewhere', 'active'), fx('tools', 'curious')], { minAge: 1.5 }),
    baby('BA-048', 'festival', [fx('window', 'curious'), fx('sleep', 'rest'), fx('story', 'learn')], { params: 'festival', minAge: 0.5 }),
    baby('BA-049', 'festival', [fx('tradition', 'social'), fx('clothes', 'joy'), ask('near')], { params: 'festival', minAge: 1, cooldown: 300 }),
    baby('BA-050', 'moneyTight', [fx('pretend', 'curious'), fx('nature', 'active'), ask('story')], { minAge: 1.5 }),
  );
  // ---- Childhood (3-11): 39 more moments; real friends and clubs where the moment names them ----
  const sib = (w, p) => { const s = p.parents.flatMap(id => w.people[id].children).filter((id, i, a) => a.indexOf(id) === i && id !== p.id).map(id => w.people[id]).filter(q => q.alive && !q.away && !P.isAdult(w, q)); return s.length ? s[0] : null; };
  const birthdaySoon = (w, p) => { const d = ((w.day - p.birthDay) % 365 + 365) % 365; return d >= 335; };
  const myFriend = (w, p) => { const f = (st(w).friends || []).map(x => w.people[x.id]).filter(q => q && q.alive && !q.away); return f.length ? f[(w.day / 30 | 0) % f.length] : null; };
  Object.assign(Pl.CONDITIONS, {
    sibling: (w, p) => !!sib(w, p),
    carerBiz: (w, p) => { const g = carer(w, p); return !!g && g.manages >= 0 && !!w.biz[g.manages] && w.biz[g.manages].open; },
    birthdaySoon: (w, p) => birthdaySoon(w, p) && !!carer(w, p),
    inClub: w => !!st(w).club,
    friendHere: (w, p) => !!myFriend(w, p),
  });
  Object.assign(Pl.PARAMS, {
    sibling: (w, p) => { const q = sib(w, p), g = carer(w, p); return { other: q ? q.first : '', carer: g ? P.name(g) : '' }; },
    friendNamed: (w, p) => { const q = myFriend(w, p), g = carer(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1, carer: g ? P.name(g) : '' }; },
  });
  const kid = (id, when, choices, o) => Object.assign({ id, stages: ['child'], minAge: 5, maxAge: 11, when, chance: 0.2, cooldown: 99999, expires: 15, imp: 1, params: 'classmate', choices }, o || {});
  const req = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    kid('CH-003', 'homework', [req('enter', 'SET_EFFORT', 'effortHard'), fx('help', 'social'), fx('practice', 'learn')], { minAge: 7 }),
    kid('CH-005', 'homework', [fx('science', 'learn'), fx('novel', 'curious'), req('together', 'MAKE_FRIEND', 'friendInCard')], { minAge: 6 }),
    kid('CH-007', 'homework', [fx('lead', 'focus'), req('team', 'MAKE_FRIEND', 'friendInCard'), fx('poster', 'curious')], { minAge: 8, imp: 2 }),
    kid('CH-008', 'moved', [ask('visit'), fx('friends', 'social'), fx('embrace', 'brave')], { chance: 0.8, cooldown: 360, imp: 2, params: 'carer' }),
    kid('CH-010', 'newClassmate', [req('practice', 'MAKE_FRIEND', 'friendInCard'), fx('group', 'social'), fx('alone', 'learn')], { minAge: 7, params: 'newcomer' }),
    kid('CH-012', 'sibling', [fx('share', 'social'), fx('boundary', 'steady'), ask('mediate')], { minAge: 4, cooldown: 360, params: 'sibling' }),
    kid('CH-013', 'moneyTight', [ask('worries'), fx('ask', 'curious'), fx('connected', 'social')], { params: 'carer' }),
    kid('CH-014', 'carerBiz', [fx('hours', 'focus'), fx('signs', 'curious'), fx('play', 'joy')], { minAge: 8, params: 'carer' }),
    kid('CH-017', 'carerOut', [ask('explain'), fx('relative', 'social'), fx('plan', 'steady')], { minAge: 6, params: 'carer', imp: 2 }),
    kid('CH-018', 'hasCarer', [fx('park', 'active'), fx('museum', 'learn'), req('save', 'ASK_ALLOWANCE', 'allowance')], { minAge: 7, params: 'carer' }),
    kid('CH-019', 'sibling', [fx('schedule', 'steady'), fx('storage', 'social'), ask('mediate')], { minAge: 6, cooldown: 360, params: 'sibling' }),
    kid('CH-020', 'festival', [fx('celebrate', 'social'), fx('recipe', 'learn'), fx('stories', 'curious')], { params: 'festival', cooldown: 360 }),
    kid('CH-022', 'friendHere', [fx('talk', 'social'), ask('mediate'), fx('time', 'steady')], { params: 'friendNamed', cooldown: 360, imp: 2 }),
    kid('CH-023', 'homework', [fx('compromise', 'social'), fx('split', 'focus'), ask('teacher')], { minAge: 8 }),
    kid('CH-024', 'friendHere', [ask('ask'), fx('day', 'joy'), fx('decline', 'steady')], { minAge: 7, params: 'friendNamed' }),
    kid('CH-025', 'hasCarer', [ask('adult'), fx('support', 'social'), fx('away', 'calm')], { minAge: 6, imp: 2, params: 'carer' }),
    kid('CH-026', 'friendHere', [fx('letters', 'social'), ask('calls'), req('new', 'MAKE_FRIEND', 'friendInCard')], { minAge: 6, params: 'classmate', chance: 0.12 }),
    kid('CH-027', 'birthdaySoon', [fx('mixed', 'social'), req('close', 'MAKE_FRIEND', 'friendInCard'), fx('family', 'joy')], { chance: 0.6, cooldown: 300 }),
    kid('CH-028', 'friendHere', [fx('respect', 'steady'), ask('adult'), fx('boundary', 'calm')], { minAge: 8, params: 'friendNamed' }),
    kid('CH-029', 'moneyTight', [ask('adult'), fx('share', 'social'), fx('drive', 'proud')], { minAge: 7, params: 'carer' }),
    kid('CH-030', 'friendHere', [fx('connect', 'social'), fx('separate', 'steady'), fx('gossip', 'calm')], { minAge: 8, params: 'friendNamed' }),
    kid('CH-033', 'hasCarer', [fx('explore', 'curious'), fx('photo', 'learn'), fx('picnic', 'rest')], { params: 'carer' }),
    kid('CH-034', 'clubOffer', [req('train', 'ASK_CLUB', 'club_chess'), fx('casual', 'learn'), fx('teach', 'social')], { minAge: 7, params: 'fees' }),
    kid('CH-035', 'clubOffer', [req('lessons', 'ASK_CLUB', 'club_swimming'), fx('confidence', 'brave'), fx('wait', 'steady')], { imp: 2, params: 'fees' }),
    kid('CH-036', 'hasCarer', [fx('helmet', 'active'), fx('walk', 'steady'), fx('friends', 'social')], { minAge: 6, params: 'carer' }),
    kid('CH-037', 'clubOffer', [req('submit', 'ASK_CLUB', 'club_art'), fx('organise', 'social'), fx('visit', 'curious')], { minAge: 6, params: 'fees' }),
    kid('CH-038', 'clubOffer', [req('game', 'ASK_CLUB', 'club_science'), fx('logic', 'learn'), fx('art', 'curious')], { minAge: 8, params: 'fees' }),
    kid('CH-039', 'always', [fx('train', 'active'), fx('water', 'social'), fx('cheer', 'joy')], { minAge: 6 }),
    kid('CH-040', 'hasCarer', [fx('recipe', 'learn'), fx('prepare', 'active'), fx('notebook', 'curious')], { params: 'carer' }),
    kid('CH-041', 'hasCarer', [fx('letter', 'learn'), fx('cleanup', 'active'), ask('council')], { minAge: 8, params: 'carer' }),
    kid('CH-042', 'hasCarer', [fx('help', 'social'), ask('alert'), fx('document', 'curious')], { minAge: 7, params: 'carer' }),
    kid('CH-043', 'homework', [fx('system', 'learn'), fx('sort', 'active'), fx('learn', 'curious')], { minAge: 8 }),
    kid('CH-044', 'always', [fx('comic', 'curious'), fx('interview', 'social'), fx('photo', 'learn')], { minAge: 7 }),
    kid('CH-045', 'always', [fx('posters', 'curious'), fx('collection', 'social'), fx('visit', 'joy')], { minAge: 6 }),
    kid('CH-046', 'homework', [fx('lead', 'social'), fx('quiet', 'learn'), fx('chairs', 'steady')], { minAge: 7 }),
    kid('CH-047', 'festival', [fx('perform', 'social'), fx('stall', 'focus'), fx('visit', 'joy')], { params: 'festival', cooldown: 360 }),
    kid('CH-048', 'rainy', [fx('plan', 'steady'), fx('bag', 'focus'), ask('neighbours')], { cooldown: 360, imp: 2, params: 'carer' }),
    kid('CH-049', 'inClub', [fx('fair', 'social'), fx('represent', 'active'), fx('cheer', 'joy')], { minAge: 7 }),
    kid('CH-050', 'homework', [fx('run', 'social'), fx('support', 'steady'), fx('vote', 'learn')], { minAge: 8, imp: 2 }),
  );
  // ---- Teens (12-17): 41 more moments. Real requests: study pace, clubs, school, after-school plan, friends,
  // pocket money; teens cannot be hired by the engine, so job moments are reactions (revised, not faked).
  Object.assign(Pl.CONDITIONS, { teenAny: () => true, bigBirthday: (w, p) => birthdaySoon(w, p) });
  const teen = (id, when, choices, o) => Object.assign({ id, stages: ['teen'], minAge: 12, maxAge: 17, when, chance: 0.2, cooldown: 99999, expires: 20, imp: 1, params: 'classmate', choices }, o || {});
  Pl.EVENTS.push(
    teen('TE-002', 'bright', [req('prepare', 'SET_EFFORT', 'effortHard'), fx('mentor', 'learn'), fx('decline', 'steady')], { minAge: 15, imp: 2 }),
    teen('TE-004', 'exams', [req('science', 'SET_PLAN', 'plan_degree'), req('humanities', 'SET_PLAN', 'plan_degree'), req('vocational', 'SET_PLAN', 'plan_vocational')], { minAge: 14, imp: 2 }),
    teen('TE-005', 'homework', [fx('prefect', 'social'), fx('club', 'focus'), req('academics', 'SET_EFFORT', 'effortHard')], { minAge: 13, imp: 2 }),
    teen('TE-007', 'afterSchool', [fx('evidence', 'focus'), req('compromise', 'SET_PLAN', 'plan_vocational'), req('alternative', 'SET_PLAN', 'plan_work')], { minAge: 15, imp: 2, params: 'fees' }),
    teen('TE-009', 'bright', [fx('apply', 'brave'), fx('local', 'learn'), fx('decline', 'steady')], { minAge: 15 }),
    teen('TE-010', 'homework', [fx('review', 'focus'), fx('mentor', 'learn'), req('improve', 'SET_EFFORT', 'effortHard')], { minAge: 13 }),
    teen('TE-012', 'teenAny', [fx('itinerary', 'brave'), fx('supervised', 'social'), fx('local', 'steady')], { minAge: 15 }),
    teen('TE-013', 'teenAny', [fx('privacy', 'steady'), fx('trusted', 'social'), fx('logoff', 'rest')], { minAge: 13 }),
    teen('TE-014', 'teenAny', [fx('kitchen', 'social'), fx('tutor', 'learn'), req('exams', 'SET_EFFORT', 'effortHard')], { minAge: 14 }),
    teen('TE-015', 'teenAny', [fx('practical', 'steady'), req('distinct', 'ASK_ALLOWANCE', 'allowance'), fx('reuse', 'calm')], { minAge: 13, params: 'fees' }),
    teen('TE-016', 'afterSchool', [fx('calm', 'calm'), fx('relative', 'social'), fx('delay', 'steady')], { minAge: 15, imp: 2, params: 'fees' }),
    teen('TE-017', 'inClub', [req('drop', 'QUIT_CLUB', 'stopSpending'), req('reduce', 'SET_EFFORT', 'effortRelaxed'), fx('renegotiate', 'calm')], { imp: 2, params: 'fees' }),
    teen('TE-018', 'festival', [fx('family', 'social'), fx('explore', 'curious'), fx('reflect', 'calm')], { params: 'festival', cooldown: 360 }),
    teen('TE-019', 'hasFriend', [fx('boundary', 'steady'), fx('adult', 'calm'), fx('back', 'rest')], { params: 'friend' }),
    teen('TE-020', 'hasFriend', [fx('listen', 'social'), fx('help', 'steady'), fx('adult', 'calm')], { params: 'friend', imp: 2 }),
    teen('TE-021', 'hasFriend', [fx('visits', 'social'), fx('online', 'steady'), req('club', 'ASK_CLUB', 'club_football')], { params: 'friend', chance: 0.12 }),
    teen('TE-022', 'teenAny', [fx('ask', 'brave'), req('new', 'MAKE_FRIEND', 'friendInCard'), fx('mentor', 'calm')], { imp: 2 }),
    teen('TE-023', 'crush', [fx('friends', 'social'), req('crush', 'MAKE_FRIEND', 'friendInCard'), fx('skip', 'rest')], { minAge: 14, params: 'crush' }),
    teen('TE-025', 'hasFriend', [fx('gossip', 'calm'), fx('fair', 'social'), fx('boundary', 'steady')], { params: 'friend' }),
    teen('TE-026', 'teenAny', [fx('report', 'steady'), fx('calm', 'calm'), fx('ignore', 'rest')], { minAge: 13, imp: 2 }),
    teen('TE-027', 'hasFriend', [fx('affordable', 'joy'), fx('free', 'social'), fx('optout', 'steady')], { params: 'friend', minAge: 14 }),
    teen('TE-028', 'inClub', [fx('vote', 'social'), fx('mediate', 'calm'), fx('aside', 'steady')]),
    teen('TE-030', 'homework', [fx('modest', 'proud'), fx('thanks', 'social'), fx('private', 'steady')], { minAge: 13 }),
    teen('TE-031', 'teenAny', [fx('shop', 'focus'), fx('volunteer', 'social'), req('study', 'SET_EFFORT', 'effortHard')], { minAge: 15, imp: 2 }),
    teen('TE-032', 'teenAny', [req('savings', 'ASK_ALLOWANCE', 'allowance'), fx('budget', 'learn'), fx('wait', 'steady')], { minAge: 14, params: 'fees' }),
    teen('TE-033', 'teenAny', [fx('save', 'steady'), req('family', 'ASK_ALLOWANCE', 'allowance'), fx('used', 'calm')], { minAge: 13, params: 'fees' }),
    teen('TE-034', 'homework', [fx('tutor', 'learn'), fx('group', 'social'), req('own', 'SET_EFFORT', 'effortHard')], { minAge: 14 }),
    teen('TE-035', 'teenAny', [fx('legal', 'steady'), fx('safer', 'calm'), fx('decline', 'rest')], { minAge: 16 }),
    teen('TE-036', 'teenAny', [fx('crafts', 'curious'), fx('service', 'social'), req('team', 'MAKE_FRIEND', 'friendInCard')], { minAge: 14 }),
    teen('TE-037', 'hasFriend', [fx('lend', 'social'), fx('help', 'steady'), fx('decline', 'calm')], { params: 'friend', minAge: 14 }),
    teen('TE-039', 'bigBirthday', [fx('save', 'steady'), fx('treat', 'joy'), fx('donate', 'proud')], { chance: 0.5, cooldown: 300 }),
    teen('TE-040', 'teenAny', [fx('adult', 'calm'), fx('research', 'learn'), fx('ignore', 'steady')], { minAge: 15 }),
    teen('TE-041', 'teenAny', [fx('evidence', 'learn'), fx('petition', 'social'), fx('cleanup', 'active')], { minAge: 13 }),
    teen('TE-042', 'homework', [fx('mentor', 'social'), fx('peer', 'learn'), fx('decline', 'rest')], { minAge: 14 }),
    teen('TE-043', 'afterSchool', [fx('observe', 'curious'), fx('interview', 'social'), req('other', 'SET_PLAN', 'plan_vocational')], { minAge: 15, params: 'fees' }),
    teen('TE-044', 'homework', [fx('run', 'social'), fx('policy', 'learn'), fx('observe', 'curious')], { minAge: 14, imp: 2 }),
    teen('TE-045', 'moved', [fx('concerns', 'steady'), fx('compromise', 'calm'), fx('open', 'brave')], { chance: 0.8, cooldown: 360, imp: 2 }),
    teen('TE-046', 'teenAny', [fx('speak', 'brave'), fx('adult', 'steady'), fx('support', 'social')], { minAge: 13, imp: 2 }),
    teen('TE-047', 'afterSchool', [req('plan', 'SET_PLAN', 'plan_work'), req('training', 'SET_PLAN', 'plan_vocational'), req('study', 'SET_PLAN', 'plan_degree')], { minAge: 16, imp: 2, params: 'fees' }),
    teen('TE-048', 'teenAny', [fx('educational', 'learn'), fx('collab', 'social'), fx('privacy', 'steady')], { minAge: 14 }),
    teen('TE-049', 'exams', [req('refuse', 'SET_EFFORT', 'effortHard'), fx('report', 'steady'), fx('help', 'learn')], { minAge: 15, imp: 2 }),
  );
  Pl.markImportant = () => { for (const e of Pl.EVENTS) if (e.imp === 2) Pl.IMPORTANT.add(e.id); };
  Pl.markImportant();
})(globalThis.LES = globalThis.LES || {});
