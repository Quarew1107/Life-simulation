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
  // ---- Adulthood (18-59): 83 more moments. Real requests where the engine has them (job, pay, study, savings,
  // home, business, family, health, volunteering, donations); otherwise the character's own reaction. Revised so
  // nothing is faked: no loans or tax refunds that the books do not have, no hires the player cannot make.
  const myBiz = (w, p) => (p.manages >= 0 && w.biz[p.manages] && w.biz[p.manages].open ? w.biz[p.manages] : null);
  const partnerOf = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return q && q.alive && !q.away && !q.inst ? q : null; };
  const near = q => q && q.alive && !q.away && !q.inst;
  const staffOf = (w, p) => { const b = myBiz(w, p); if (!b) return 0; let k = 0; for (const q of w.living) if (q.alive && q.job && q.job.biz >= 0 && w.biz[q.job.biz] === b) k++; return k; };
  const myKid = (w, p, lo, hi) => { const l = p.children.map(id => w.people[id]).filter(c => near(c) && P.age(w, c) >= lo && P.age(w, c) < hi && p.careOf.includes(c.id)); return l.length ? l[(w.day / 30 | 0) % l.length] : null; };
  const relatives = (w, p) => p.parents.concat(p.children).map(id => w.people[id]).filter(q => near(q) && P.isAdult(w, q));
  const turn = (w, l) => (l.length ? l[(w.day / 30 | 0) % l.length] : null);
  const needy = (w, p) => turn(w, relatives(w, p).filter(q => q.cash < q.mcost));
  const lowRel = (w, p) => turn(w, relatives(w, p).filter(q => q.happy < 40));
  const hasJob = p => !!p.job && !p.job.fixedTitle;
  const roomy = (w, p) => p.cash > 6 * p.mcost, wealthy = (w, p) => p.cash > 12 * p.mcost;
  const hhIncome = (w, p) => Math.max(0, p.incomeEMA) + (partnerOf(w, p) ? Math.max(0, partnerOf(w, p).incomeEMA) : 0);
  Object.assign(Pl.CONDITIONS, {
    aJob: (w, p) => hasJob(p),
    aNewJob: (w, p) => hasJob(p) && w.day - p.job.startDay < 90,
    aBusyJob: (w, p) => hasJob(p) && p.stress > 45,
    aLongJob: (w, p) => hasJob(p) && w.day - p.job.startDay > 720,
    aOpenings: (w, p) => hasJob(p) && Pl.openings(w, p).length > 0,
    aJobless: (w, p) => !p.job && !p.enrol && !p.retired && !myBiz(w, p),
    aBiz: (w, p) => !!myBiz(w, p),
    aBizStaff: (w, p) => staffOf(w, p) > 0,
    aBizSolo: (w, p) => !!myBiz(w, p) && staffOf(w, p) === 0,
    aBizOk: (w, p) => { const b = myBiz(w, p); return !!b && b.cash > w.px(5000); },
    aBizOld: (w, p) => !!myBiz(w, p) && P.age(w, p) >= 45,
    aNoBiz: (w, p) => !myBiz(w, p) && P.age(w, p) >= 25 && roomy(w, p) && p.bankruptUntil <= w.day,
    aDebt: (w, p) => (p.debt.study || 0) + (p.debt.medical || 0) > 0,
    aRoomy: roomy, aWealthy: wealthy,
    aRoomyHead: (w, p) => p.isHead && roomy(w, p) && p.tiers.housing < 4,
    aRentHigh: (w, p) => p.isHead && p.tiers.housing > 0 && Pl.rentOf(w, p.tiers.housing) > 0.4 * hhIncome(w, p),
    aYoungHome: (w, p) => !p.isHead && P.age(w, p) < 30,
    aShortSave: (w, p) => P.age(w, p) >= 40 && P.invValue(w, p) + p.cash < 24 * p.mcost,
    aSlump: (w, p) => !!w.mkt && st(w).idxPeak > 0 && w.mkt.idx < 0.9 * st(w).idxPeak,
    aNeedy: (w, p) => !!needy(w, p),
    aLowRel: (w, p) => !!lowRel(w, p),
    aPartner: (w, p) => !!partnerOf(w, p),
    aPartnerAway: (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return !!q && q.alive && !!q.away; },
    aDating: (w, p) => p.partnerId === null && !!st(w).dating,
    aSingle: (w, p) => p.partnerId === null && !st(w).dating,
    aKidSchool: (w, p) => !!myKid(w, p, 7, 17),
    aKidTeen: (w, p) => !!myKid(w, p, 15, 18),
    aKidSmall: (w, p) => !!myKid(w, p, 0, 6),
    aSoloParent: (w, p) => !partnerOf(w, p) && !!myKid(w, p, 0, 18),
    aTryBaby: (w, p) => !!partnerOf(w, p) && st(w).babyWish === 'yes' && !myKid(w, p, 0, 2),
    aUnwell: (w, p) => p.health < 70,
    aTired: (w, p) => p.stress > 40 || p.energy < 40,
    aCivic: (w, p) => P.age(w, p) >= 21,
  });
  const kidP = (lo, hi) => (w, p) => { const c = myKid(w, p, lo, hi); return { child: c ? c.first : '', pid: c ? c.id : -1 }; };
  Object.assign(Pl.PARAMS, {
    needy: (w, p) => { const q = needy(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    lowRel: (w, p) => { const q = lowRel(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    kidStudy: kidP(7, 17), kidTeen: kidP(15, 18), kidSmall: kidP(0, 6),
    dating: (w, p) => { const d = st(w).dating, q = d ? w.people[d.pid] : null; return { other: q ? P.name(q) : '' }; },
  });
  Object.assign(Pl.TARGETS, {
    homeDown: (w, p) => (p.tiers.housing > 0 ? { tier: p.tiers.housing - 1 } : null),
    sellBiz: (w, p) => (myBiz(w, p) ? {} : null),
    datingInCard: (w, p) => (st(w).dating ? { pid: st(w).dating.pid } : null),
    giftFamily: (w, p) => { const q = relatives(w, p)[0]; return q ? { pid: q.id, share: 0.1 } : null; },
  });
  const ad = (id, when, choices, o) => Object.assign({ id, stages: ['adult'], minAge: 18, maxAge: 59, when, chance: 0.12, cooldown: 720, expires: 20, imp: 1, params: null, choices }, o || {});
  Pl.EVENTS.push(
    // Career
    ad('AD-002', 'aNewJob', [req('evidence', 'ASK_RAISE', 'raise'), fx('accept', 'steady'), fx('benefits', 'calm')], { params: 'job', chance: 0.4, cooldown: 99999 }),
    ad('AD-005', 'aBusyJob', [fx('flexible', 'calm'), req('overtime', 'REST', 'rest'), req('change', 'APPLY_JOB', 'typicalPay')], { params: 'job', cooldown: 360 }),
    ad('AD-006', 'aJob', [fx('report', 'brave'), fx('mediate', 'calm'), req('transfer', 'APPLY_JOB', 'typicalPay')], { chance: 0.05, cooldown: 1440 }),
    ad('AD-009', 'aJob', [fx('request', 'learn'), fx('mentor', 'social'), req('own', 'ENROLL', 'bestCourse')], { minAge: 22 }),
    ad('AD-010', 'aLongJob', [fx('commit', 'steady'), req('explore', 'APPLY_JOB', 'bestPaid'), req('redesign', 'ASK_RAISE', 'raise')], { params: 'job' }),
    // Business
    ad('AD-012', 'aNoBiz', [req('open', 'START_BIZ', 'bizCheap'), fx('learn', 'learn'), fx('decline', 'steady')], { chance: 0.06, cooldown: 1440 }),
    ad('AD-013', 'aBizSolo', [fx('recruit', 'social'), fx('junior', 'proud'), fx('solo', 'steady')], { params: 'myBiz' }),
    ad('AD-015', 'aBiz', [fx('service', 'focus'), req('invest', 'INJECT', 'inject25'), fx('niche', 'curious')], { params: 'myBiz', chance: 0.1 }),
    ad('AD-016', 'aBizStaff', [fx('raise', 'social'), fx('training', 'learn'), fx('explain', 'steady')], { params: 'myBiz' }),
    ad('AD-017', 'aBizOk', [fx('test', 'curious'), req('invest', 'INJECT', 'inject25'), fx('local', 'steady')], { params: 'myBiz' }),
    ad('AD-018', 'aBiz', [fx('alternate', 'focus'), fx('negotiate', 'calm'), fx('limit', 'steady')], { params: 'myBiz', chance: 0.08 }),
    ad('AD-019', 'aBizOld', [fx('family', 'social'), fx('manager', 'steady'), req('sale', 'SELL_BIZ', 'sellBiz')], { params: 'myBiz', minAge: 45, cooldown: 1440 }),
    ad('AD-020', 'aBiz', [fx('apply', 'proud'), req('cofund', 'DONATE', 'donateSmall'), fx('decline', 'steady')], { params: 'myBiz', chance: 0.06 }),
    // Money
    ad('AD-023', 'aRoomy', [fx('reserve', 'steady'), req('invest', 'INVEST', 'invest10'), fx('treat', 'joy')], { chance: 0.08 }),
    ad('AD-027', 'aNeedy', [req('gift', 'GIFT', 'giftInCard'), fx('budget', 'social'), fx('decline', 'steady')], { params: 'needy', chance: 0.2, cooldown: 360 }),
    ad('AD-028', 'aDebt', [fx('plan', 'steady'), fx('extra', 'focus'), fx('advice', 'calm')], { chance: 0.15 }),
    ad('AD-029', 'aRoomyHead', [fx('save', 'steady'), req('move', 'MOVE_HOME', 'homeUp'), fx('rent', 'calm')], { minAge: 25 }),
    ad('AD-030', 'aWealthy', [req('plan', 'INVEST', 'invest25'), req('family', 'GIFT', 'giftFamily'), fx('reserve', 'steady')], { minAge: 25 }),
    // Romance
    ad('AD-033', 'aPartner', [req('discuss', 'COUNSEL', 'partnerInCard'), fx('reconsider', 'calm'), fx('time', 'steady')], { params: 'partner', chance: 0.08 }),
    ad('AD-034', 'aPartnerAway', [fx('visits', 'social'), fx('relocate', 'brave'), req('end', 'SEPARATE', 'partnerInCard')], { chance: 0.3, cooldown: 360 }),
    ad('AD-038', 'aDating', [req('agree', 'ASK_PARTNER', 'datingInCard'), fx('talk', 'calm'), fx('end', 'steady')], { params: 'dating', chance: 0.25, cooldown: 180 }),
    ad('AD-039', 'aSingle', [fx('boundaries', 'calm'), fx('date', 'social'), fx('decline', 'steady')], { mature: true, maxAge: 50, chance: 0.05 }),
    // Family
    ad('AD-042', 'aKidSchool', [req('home', 'CARE_CHILD', 'personInCard'), fx('subsidy', 'learn'), fx('later', 'steady')], { params: 'kidStudy', maxAge: 70, stages: ['adult', 'senior'] }),
    ad('AD-043', 'aKidTeen', [req('support', 'CARE_CHILD', 'personInCard'), fx('finances', 'steady'), fx('mixed', 'calm')], { params: 'kidTeen', maxAge: 70, stages: ['adult', 'senior'] }),
    ad('AD-046', 'aSoloParent', [fx('agree', 'calm'), req('family', 'VISIT', 'trusted'), fx('schedule', 'steady')], { chance: 0.15, cooldown: 540 }),
    ad('AD-048', 'aBizStaff', [fx('merit', 'steady'), fx('intern', 'social'), fx('boundary', 'calm')], { params: 'myBiz', chance: 0.06 }),
    ad('AD-049', 'aKidSmall', [req('backup', 'VISIT', 'trusted'), req('leave', 'REST', 'rest'), req('care', 'CARE_CHILD', 'personInCard')], { params: 'kidSmall', chance: 0.1 }),
    ad('AD-050', 'volunteers', [req('help', 'VOLUNTEER', 'volunteer'), req('donate', 'DONATE', 'donateSmall'), fx('kin', 'social')], { params: 'welfare', minAge: 25, chance: 0.06 }),
    // Health
    ad('AD-054', 'aUnwell', [req('rehab', 'SEE_DOCTOR', 'doctor'), fx('adjust', 'calm'), req('rest', 'REST', 'rest')], { chance: 0.3, cooldown: 360 }),
    ad('AD-055', 'aTired', [req('routine', 'REST', 'rest'), req('doctor', 'SEE_DOCTOR', 'doctor'), fx('evenings', 'calm')], { chance: 0.1 }),
    ad('AD-056', 'always', [fx('support', 'steady'), fx('cut', 'calm'), req('replace', 'SET_EXERCISE', 'exLight')], { minAge: 20, chance: 0.05, cooldown: 1440 }),
    ad('AD-057', 'aLowRel', [req('contact', 'VISIT', 'personInCard'), req('stay', 'VISIT', 'personInCard'), fx('professional', 'calm')], { params: 'lowRel', sensitive: true, imp: 2, chance: 0.1, cooldown: 540, stages: ['adult', 'senior'], maxAge: 99 }),
    ad('AD-059', 'rainy', [req('guidance', 'SEE_DOCTOR', 'doctor'), fx('neighbours', 'social'), fx('hygiene', 'steady')], { chance: 0.08, cooldown: 360, stages: ['adult', 'senior'], maxAge: 99 }),
    ad('AD-060', 'aTryBaby', [req('clinic', 'SEE_DOCTOR', 'doctor'), fx('adopt', 'calm'), req('timing', 'BABY_WISH', 'babyLater')], { params: 'partner', minAge: 25, maxAge: 45, imp: 2, chance: 0.15, cooldown: 720 }),
    // Home and travel
    ad('AD-062', 'moved', [fx('commute', 'steady'), fx('schools', 'learn'), req('family', 'VISIT', 'trusted')], { chance: 0.5, cooldown: 360 }),
    ad('AD-065', 'aOpenings', [req('relocate', 'APPLY_JOB', 'bestPaid'), fx('commute', 'steady'), fx('stay', 'calm')], { params: 'job', chance: 0.08 }),
    ad('AD-066', 'aRoomyHead', [fx('repair', 'steady'), req('upgrade', 'MOVE_HOME', 'homeUp'), fx('save', 'calm')], { minAge: 30, chance: 0.06, cooldown: 1080 }),
    ad('AD-067', 'aYoungHome', [fx('budget', 'learn'), fx('solo', 'brave'), fx('stay', 'steady')], { maxAge: 29, chance: 0.15 }),
    ad('AD-068', 'aJob', [fx('closer', 'curious'), fx('commute', 'rest'), fx('habits', 'steady')], { chance: 0.05 }),
    ad('AD-069', 'aSlump', [req('staycation', 'TRAVEL', 'domestic'), fx('postpone', 'steady'), req('local', 'REST', 'rest')], { chance: 0.3, cooldown: 540 }),
    ad('AD-070', 'elderCare', [req('modify', 'MOVE_HOME', 'homeUp'), req('rental', 'GIFT', 'giftInCard'), req('share', 'VISIT', 'personInCard')], { params: 'elder', minAge: 25, chance: 0.15, cooldown: 720 }),
    // Civic life
    ad('AD-071', 'aCivic', [fx('schools', 'learn'), fx('health', 'steady'), fx('balanced', 'calm')], { chance: 0.05 }),
    ad('AD-073', 'aCivic', [req('campaign', 'VOLUNTEER', 'volunteer'), fx('mixed', 'calm'), fx('accept', 'steady')], { chance: 0.04 }),
    ad('AD-074', 'aCivic', [req('cleanup', 'VOLUNTEER', 'volunteer'), fx('council', 'steady'), req('contribute', 'DONATE', 'donateSmall')], { chance: 0.05 }),
    ad('AD-075', 'aCivic', [fx('subsidy', 'social'), fx('zoning', 'learn'), fx('study', 'steady')], { chance: 0.04 }),
    ad('AD-076', 'aCivic', [req('watch', 'VOLUNTEER', 'volunteer'), fx('dialogue', 'social'), fx('evidence', 'steady')], { chance: 0.04 }),
    ad('AD-078', 'aCivic', [fx('board', 'proud'), req('mentor', 'VOLUNTEER', 'volunteer'), fx('uninvolved', 'rest')], { minAge: 25, chance: 0.04 }),
    // Risks: the character says no, asks, or reports (reactions only: the engine has no schemes to join)
    ad('AD-081', 'aRoomy', [fx('reject', 'steady'), fx('adviser', 'calm'), fx('report', 'brave')], { chance: 0.05 }),
    ad('AD-082', 'aCivic', [fx('statement', 'brave'), fx('advice', 'calm'), fx('decline', 'steady')], { chance: 0.03 }),
    ad('AD-083', 'aCivic', [fx('calm', 'calm'), fx('leave', 'steady'), fx('call', 'brave')], { chance: 0.03 }),
    ad('AD-084', 'aBizStaff', [fx('audit', 'focus'), fx('mediate', 'calm'), fx('report', 'brave')], { params: 'myBiz', chance: 0.05 }),
    ad('AD-085', 'aCivic', [fx('decline', 'steady'), fx('legal', 'social'), fx('help', 'calm')], { chance: 0.03 }),
    ad('AD-086', 'aCivic', [fx('refuse', 'steady'), fx('transport', 'calm'), fx('encourage', 'social')], { chance: 0.03 }),
    ad('AD-087', 'aJob', [fx('reject', 'steady'), fx('advice', 'calm'), fx('report', 'brave')], { chance: 0.03 }),
    ad('AD-088', 'aRoomy', [fx('disclose', 'curious'), fx('withdraw', 'steady'), fx('warn', 'brave')], { chance: 0.04 }),
    ad('AD-089', 'aCivic', [fx('refuse', 'steady'), fx('legit', 'curious'), fx('report', 'brave')], { chance: 0.03 }),
    ad('AD-090', 'aCivic', [fx('counsel', 'calm'), fx('mediate', 'social'), fx('formal', 'steady')], { chance: 0.03 }),
    // Setbacks
    ad('AD-092', 'bizShort', [fx('creditors', 'calm'), req('sell', 'SELL_BIZ', 'sellBiz'), req('inject', 'INJECT', 'inject25')], { params: 'myBiz', imp: 2, chance: 0.3, cooldown: 360 }),
    ad('AD-093', 'aRentHigh', [req('downsize', 'MOVE_HOME', 'homeDown'), fx('budget', 'steady'), fx('help', 'calm')], { chance: 0.25, cooldown: 360 }),
    ad('AD-095', 'aCivic', [fx('talk', 'social'), fx('mediate', 'calm'), fx('away', 'steady')], { chance: 0.04 }),
    ad('AD-096', 'rainy', [fx('claims', 'steady'), req('recovery', 'VOLUNTEER', 'volunteer'), req('fund', 'DONATE', 'donateSmall')], { chance: 0.03, stages: ['adult', 'senior'], maxAge: 99 }),
    ad('AD-098', 'aShortSave', [req('save', 'INVEST', 'invest10'), fx('second', 'focus'), fx('reset', 'calm')], { minAge: 40, chance: 0.15 }),
    ad('AD-099', 'aJob', [fx('evidence', 'steady'), fx('review', 'calm'), fx('legal', 'focus')], { chance: 0.03 }),
    ad('AD-100', 'aJobless', [req('coordinate', 'VOLUNTEER', 'volunteer'), req('coop', 'START_BIZ', 'bizCheap'), req('retrain', 'ENROLL', 'bestCourse')], { minAge: 22, chance: 0.15 }),
    // Learning and making things
    ad('AD-102', 'always', [fx('classes', 'learn'), fx('exchange', 'social'), fx('online', 'focus')], { chance: 0.04 }),
    ad('AD-103', 'aCivic', [fx('elders', 'social'), fx('archives', 'learn'), req('exhibit', 'VOLUNTEER', 'volunteer')], { minAge: 25, chance: 0.03 }),
    ad('AD-104', 'always', [fx('workers', 'social'), fx('science', 'learn'), fx('private', 'rest')], { chance: 0.03 }),
    ad('AD-105', 'aCivic', [req('mentor', 'VOLUNTEER', 'volunteer'), req('literacy', 'VOLUNTEER', 'volunteer'), fx('occasional', 'steady')], { minAge: 25, chance: 0.04 }),
    ad('AD-106', 'always', [fx('submit', 'proud'), fx('support', 'social'), fx('attend', 'joy')], { chance: 0.04 }),
    ad('AD-107', 'aJob', [fx('share', 'learn'), req('partner', 'ENROLL', 'bestCourse'), fx('decline', 'rest')], { minAge: 25, chance: 0.03 }),
    ad('AD-108', 'aJob', [fx('prepare', 'brave'), fx('copresent', 'social'), fx('decline', 'calm')], { minAge: 25, chance: 0.04 }),
    ad('AD-109', 'always', [fx('prototype', 'curious'), req('support', 'START_BIZ', 'bizBest'), fx('hobby', 'joy')], { minAge: 22, chance: 0.03 }),
    ad('AD-110', 'aLongJob', [req('study', 'ENROLL', 'bestCourse'), req('travel', 'TRAVEL', 'abroad'), fx('stay', 'steady')], { minAge: 28, chance: 0.05, cooldown: 1440 }),
    // Society: giving back from a firm or savings
    ad('AD-111', 'aBizStaff', [fx('fair', 'proud'), req('partner', 'VOLUNTEER', 'volunteer'), fx('standard', 'steady')], { params: 'myBiz', chance: 0.05 }),
    ad('AD-112', 'aWealthy', [fx('invest', 'curious'), fx('advocate', 'social'), req('transport', 'VOLUNTEER', 'volunteer')], { chance: 0.04 }),
    ad('AD-113', 'aBizStaff', [fx('wages', 'steady'), req('housing', 'DONATE', 'donateSmall'), fx('lobby', 'social')], { params: 'myBiz', chance: 0.05 }),
    ad('AD-114', 'aWealthy', [req('donate', 'DONATE', 'donateSmall'), fx('teachers', 'learn'), req('lab', 'VOLUNTEER', 'volunteer')], { chance: 0.05 }),
    ad('AD-115', 'aWealthy', [fx('equity', 'curious'), req('mentor', 'VOLUNTEER', 'volunteer'), fx('decline', 'steady')], { minAge: 30, chance: 0.04 }),
    ad('AD-116', 'aRoomy', [req('fund', 'DONATE', 'donateSmall'), fx('cover', 'steady'), fx('planning', 'learn')], { chance: 0.03 }),
    ad('AD-117', 'aCivic', [fx('documents', 'brave'), fx('inquiry', 'steady'), fx('rumours', 'calm')], { chance: 0.03 }),
    ad('AD-118', 'aCivic', [req('compete', 'START_BIZ', 'bizBest'), fx('regulation', 'learn'), fx('standards', 'social')], { minAge: 25, chance: 0.03 }),
    ad('AD-119', 'newcomer', [req('training', 'WELCOME', 'newcomerInCard'), req('recognise', 'WELCOME', 'newcomerInCard'), req('language', 'DONATE', 'donateSmall')], { params: 'newcomer', chance: 0.1, stages: ['adult', 'senior'], maxAge: 99 }),
    ad('AD-120', 'aWealthy', [req('foundation', 'DONATE', 'legacyGift'), req('institution', 'DONATE', 'donateSmall'), fx('family', 'steady')], { minAge: 50, chance: 0.08, cooldown: 1440 }),
  );
  // ---- Seniors (60+): 42 more moments. Pensions and annuities are not separate products in the engine, so those
  // moments are the character's reaction or a real saving/selling choice; care, family and community use real requests.
  const adultKids = (w, p) => p.children.map(id => w.people[id]).filter(q => near(q) && P.isAdult(w, q));
  const bizKid = (w, p) => turn(w, adultKids(w, p).filter(q => !!myBiz(w, q)));
  const smallKidParent = (w, p) => turn(w, adultKids(w, p).filter(q => q.careOf.some(id => { const c = w.people[id]; return c && c.alive && P.age(w, c) < 6; })));
  Object.assign(Pl.CONDITIONS, {
    sAny: () => true,
    sRetired: (w, p) => !!p.retired,
    sTight: (w, p) => p.cash < 3 * p.mcost,
    sInvested: (w, p) => P.invValue(w, p) > w.px(1000),
    sKid: (w, p) => adultKids(w, p).length > 0,
    sBizKid: (w, p) => !!bizKid(w, p),
    sGrandSmall: (w, p) => !!smallKidParent(w, p),
    sPartnerIll: (w, p) => { const q = partnerOf(w, p); return !!q && q.health < 50; },
    sFrail: (w, p) => p.health < 60,
  });
  const personP = f => (w, p) => { const q = f(w, p); return { other: q ? q.first : '', pid: q ? q.id : -1 }; };
  Object.assign(Pl.PARAMS, {
    sKid: personP((w, p) => turn(w, adultKids(w, p))), bizKid: personP(bizKid), grandSmall: personP(smallKidParent),
    sPartner: (w, p) => { const q = partnerOf(w, p); return { other: q ? P.name(q) : '' }; },
  });
  const se = (id, when, choices, o) => Object.assign({ id, stages: ['senior'], minAge: 60, maxAge: 120, when, chance: 0.1, cooldown: 720, expires: 20, imp: 1, params: null, choices }, o || {});
  Pl.EVENTS.push(
    // Retirement and money
    se('SE-002', 'sRetired', [fx('regular', 'steady'), req('invest', 'INVEST', 'invest10'), fx('advice', 'calm')], { chance: 0.6, cooldown: 99999 }),
    se('SE-003', 'sTight', [fx('spending', 'steady'), req('support', 'VISIT', 'trusted'), req('downsize', 'MOVE_HOME', 'homeDown')], { chance: 0.25, cooldown: 360 }),
    se('SE-004', 'sInvested', [req('rebalance', 'SELL', 'sell25'), fx('hold', 'steady'), fx('review', 'calm')], { chance: 0.15 }),
    se('SE-005', 'sRetired', [fx('work', 'proud'), req('mentor', 'VOLUNTEER', 'volunteer'), req('enjoy', 'REST', 'rest')], { maxAge: 72, chance: 0.08 }),
    se('SE-006', 'aRoomy', [fx('advice', 'calm'), fx('decline', 'steady'), req('family', 'VISIT', 'trusted')], { chance: 0.06 }),
    se('SE-007', 'aDebt', [fx('repay', 'focus'), fx('refinance', 'steady'), req('counsel', 'COUNSELLING', 'counselling')], { chance: 0.2 }),
    se('SE-008', 'aPartner', [fx('partner', 'social'), fx('family', 'steady'), fx('own', 'calm')], { params: 'sPartner', chance: 0.06 }),
    se('SE-009', 'sAny', [fx('reserve', 'steady'), fx('stage', 'calm'), req('help', 'VISIT', 'trusted')], { chance: 0.04 }),
    se('SE-010', 'aRoomy', [fx('compare', 'learn'), fx('flexible', 'steady'), fx('adviser', 'calm')], { chance: 0.05, cooldown: 1440 }),
    // Family
    se('SE-013', 'reunion', [fx('will', 'steady'), fx('equal', 'calm'), req('discuss', 'VISIT', 'personVisit')], { params: 'reunion', minAge: 65, chance: 0.06, cooldown: 1440 }),
    se('SE-014', 'sKid', [req('talk', 'VISIT', 'personVisit'), fx('mediator', 'calm'), fx('distance', 'steady')], { params: 'sKid', chance: 0.04 }),
    se('SE-016', 'sPartnerIll', [fx('pro', 'calm'), req('family', 'VISIT', 'trusted'), req('respite', 'REST', 'rest')], { params: 'sPartner', imp: 2, chance: 0.4, cooldown: 360 }),
    se('SE-017', 'sBizKid', [fx('mentor', 'social'), req('invest', 'GIFT', 'personGift'), fx('cheer', 'joy')], { params: 'bizKid', chance: 0.2, cooldown: 1080 }),
    se('SE-019', 'sGrandSmall', [req('care', 'VISIT', 'personVisit'), fx('locate', 'steady'), fx('limits', 'calm')], { params: 'grandSmall', chance: 0.12 }),
    se('SE-020', 'sKid', [req('discuss', 'VISIT', 'personVisit'), fx('mediated', 'calm'), fx('privacy', 'steady')], { params: 'sKid', chance: 0.03, cooldown: 1440 }),
    // Wellbeing
    se('SE-021', 'sAny', [req('attend', 'SEE_DOCTOR', 'doctor'), fx('schedule', 'steady'), req('transport', 'VISIT', 'trusted')], { chance: 0.1 }),
    se('SE-022', 'sFrail', [req('physio', 'SEE_DOCTOR', 'doctor'), fx('adapt', 'steady'), req('adjust', 'SET_EXERCISE', 'exLight')], { chance: 0.2, cooldown: 360 }),
    se('SE-024', 'sFrail', [req('care', 'SEE_DOCTOR', 'doctor'), req('second', 'SEE_DOCTOR', 'doctor'), req('family', 'VISIT', 'trusted')], { minAge: 65, chance: 0.15 }),
    se('SE-025', 'sAny', [req('assess', 'SEE_DOCTOR', 'doctor'), fx('aids', 'steady'), req('trusted', 'VISIT', 'trusted')], { minAge: 70, chance: 0.06 }),
    se('SE-027', 'noExercise', [req('class', 'SET_EXERCISE', 'exRegular'), req('walks', 'SET_EXERCISE', 'exLight'), req('stretch', 'SET_EXERCISE', 'exLight')], { chance: 0.15 }),
    se('SE-028', 'sAny', [req('assess', 'SEE_DOCTOR', 'doctor'), fx('aids', 'steady'), req('help', 'VISIT', 'trusted')], { minAge: 65, chance: 0.06 }),
    se('SE-029', 'bereaved', [req('group', 'COUNSELLING', 'counselling'), req('loved', 'VISIT', 'trusted'), req('quiet', 'REST', 'rest')], { params: 'bereaved', sensitive: true, chance: 0.3, cooldown: 120 }),
    se('SE-030', 'sAny', [fx('record', 'steady'), req('team', 'SEE_DOCTOR', 'doctor'), req('family', 'VISIT', 'trusted')], { minAge: 75, sensitive: true, chance: 0.05, cooldown: 1440 }),
    // Community
    se('SE-031', 'sAny', [fx('donate', 'proud'), fx('oral', 'social'), req('mentor', 'VOLUNTEER', 'volunteer')], { chance: 0.04 }),
    se('SE-032', 'sAny', [fx('background', 'learn'), fx('evidence', 'steady'), fx('independence', 'calm')], { chance: 0.03 }),
    se('SE-033', 'sAny', [req('garden', 'VOLUNTEER', 'volunteer'), fx('teach', 'social'), fx('access', 'steady')], { chance: 0.05 }),
    se('SE-034', 'sAny', [req('mentor', 'VOLUNTEER', 'volunteer'), req('fund', 'DONATE', 'donateSmall'), fx('advise', 'social')], { chance: 0.04 }),
    se('SE-035', 'sAny', [fx('write', 'proud'), req('organise', 'VOLUNTEER', 'volunteer'), fx('attend', 'joy')], { chance: 0.03, cooldown: 99999 }),
    se('SE-036', 'sRetired', [req('probono', 'VOLUNTEER', 'volunteer'), fx('archive', 'learn'), req('time', 'REST', 'rest')], { chance: 0.05 }),
    se('SE-037', 'sAny', [fx('join', 'curious'), fx('safeguards', 'steady'), fx('stay', 'calm')], { chance: 0.03 }),
    se('SE-038', 'sAny', [fx('encourage', 'proud'), fx('reconnect', 'social'), fx('private', 'joy')], { chance: 0.04 }),
    se('SE-039', 'sAny', [fx('accept', 'proud'), fx('team', 'social'), fx('decline', 'steady')], { chance: 0.02, cooldown: 99999 }),
    se('SE-040', 'sAny', [fx('share', 'social'), fx('survey', 'learn'), fx('petition', 'brave')], { chance: 0.04 }),
    // Legacy
    se('SE-041', 'sAny', [fx('family', 'social'), fx('publish', 'proud'), fx('diary', 'calm')], { minAge: 65, chance: 0.04 }),
    se('SE-042', 'sKid', [fx('verify', 'learn'), req('interview', 'VISIT', 'personVisit'), fx('archive', 'steady')], { params: 'sKid', chance: 0.04 }),
    se('SE-043', 'legacy', [fx('will', 'steady'), req('explain', 'VISIT', 'trusted'), fx('advice', 'calm')], { minAge: 70, chance: 0.1, cooldown: 1080 }),
    se('SE-044', 'aBiz', [fx('heir', 'social'), fx('manager', 'steady'), req('sale', 'SELL_BIZ', 'sellBiz')], { params: 'myBiz', imp: 2, chance: 0.2, cooldown: 1080 }),
    se('SE-046', 'sAny', [req('amends', 'VISIT', 'trusted'), fx('gratitude', 'joy'), req('support', 'COUNSELLING', 'counselling')], { minAge: 70, chance: 0.04 }),
    se('SE-047', 'aPartner', [fx('modest', 'joy'), fx('memories', 'social'), req('gather', 'VISIT', 'trusted')], { params: 'sPartner', minAge: 65, chance: 0.08, cooldown: 1800 }),
    se('SE-048', 'sAny', [fx('plan', 'steady'), fx('archive', 'learn'), req('trusted', 'VISIT', 'trusted')], { minAge: 65, chance: 0.03 }),
    se('SE-049', 'grandTeen', [req('lessons', 'VISIT', 'personVisit'), req('tools', 'VISIT', 'personVisit'), fx('mentor', 'social')], { params: 'grandTeen', chance: 0.1 }),
    se('SE-050', 'reunion', [req('reconcile', 'VISIT', 'personVisit'), req('celebrate', 'VISIT', 'personVisit'), fx('small', 'calm')], { params: 'reunion', minAge: 80, imp: 2, chance: 0.2, cooldown: 99999 }),
  );
  Pl.markImportant = () => { for (const e of Pl.EVENTS) if (e.imp === 2) Pl.IMPORTANT.add(e.id); };
  Pl.markImportant();
})(globalThis.LES = globalThis.LES || {});
