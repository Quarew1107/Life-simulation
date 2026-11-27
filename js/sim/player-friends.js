// Play a Life, plan part 4 (Nov 2026): friends for every age.
// - A friend list (w.player.friends: { id, since, how, seen }) of at most 12, with closeness 0-100 in w.player.bonds
//   (shared with the life moments). New friends start at 40 (met in person) or 20 (online). Friends you see anyway
//   (same school, same workplace, same home) stay close; others drift 2 points a month after a month apart, and a
//   friendship below 10 ends. Close friends (70+) take a little stress off every month.
// - Meeting people: classmates, colleagues and neighbours (Pl.nearby), or online (MEET_ONLINE: someone in town
//   with a similar character). The other person always decides.
// - Together: HANG_OUT (time, a small cost for adults), HELP_FRIEND (time and energy), ASK_HELP: a job (your friend
//   tells you about an opening where they work and puts in a word: you apply, and the employer counts it a little)
//   or a loan (paid back automatically over six months), INTRODUCE (a friend introduces you to someone single:
//   a date with them is a little likelier). Gifts can go to friends too.
// - Friends come to you: three moments (an invitation, a friend in trouble, a friend's good news).
// Only the played character's life uses this; nobody else's odds change.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  Pl.FRIENDS_MAX = 12;
  const here = q => !!q && q.alive && !q.away && !q.inst;
  const bond = (w, id) => { const b = st(w).bonds || {}; return b[id] === undefined ? 30 : b[id]; };
  const setBond = (w, id, v) => { (st(w).bonds = st(w).bonds || {})[id] = U.clamp(Math.round(v), 0, 100); };
  const entry = (w, id) => (st(w).friends || []).find(f => f.id === id);
  Pl.isFriend = (w, q) => !!q && !!entry(w, q.id);
  Pl.friendList = w => (st(w).friends || []).map(f => ({ f, q: w.people[f.id], c: bond(w, f.id) })).filter(x => here(x.q)).sort((a, b) => (b.c - a.c) || (a.q.id - b.q.id));
  // Who can be friends: two children or teens close in age, or two adults within 12 years. Teens and young adults
  // aged 16-19 can be friends across the adult line (often the same school year), within 2.5 years.
  Pl.friendAgeOk = (w, p, q) => {
    const a = P.age(w, p), b = P.age(w, q), ma = P.isAdult(w, p), mb = P.isAdult(w, q);
    if (ma !== mb) return a >= 16 && a < 20 && b >= 16 && b < 20 && Math.abs(a - b) <= 2.5;
    return Math.abs(a - b) <= (ma ? 12 : 2.5);
  };
  // The school building a pupil goes to (World.childDay: a private school, or the public school nearest home);
  // null for anyone not at school (under 7, or an adult).
  Pl.schoolOf = (w, p) => {
    if (!p || P.isAdult(w, p) || P.age(w, p) < 7) return null;
    const b = p.school >= 0 && w.biz[p.school] && w.biz[p.school].open ? w.biz[p.school] : null;
    const loc = b ? b.place : LES.townNear(w.town, 'school', p.homeId);
    return loc === undefined || loc === null || loc < 0 ? null : loc;
  };
  const sameSchool = (w, p, q) => { const a = Pl.schoolOf(w, p); return a !== null && a === Pl.schoolOf(w, q); };
  const family = (w, p, q) => p.parents.includes(q.id) || p.children.includes(q.id) || q.id === p.partnerId || (q.parents.length && q.parents.some(id => p.parents.includes(id)));
  Pl.addFriend = function (w, q, how, start) {
    const s = st(w);
    s.friends = s.friends || [];
    if (entry(w, q.id)) return false;
    s.friends.push({ id: q.id, since: w.day, how: how || 'met', seen: w.day });
    if (!s.bonds || s.bonds[q.id] === undefined) setBond(w, q.id, start === undefined ? 40 : start);
    return true;
  };
  const sameWhere = (w, p, q) => (p.homeId >= 0 && p.homeId === q.homeId) || (p.job && q.job && p.job.place === q.job.place) || sameSchool(w, p, q);
  // People the character could get to know, by where they meet.
  Pl.nearby = function (w, p) {
    const out = { work: [], school: [], home: [] }, ok = q => here(q) && q !== p && !Pl.isFriend(w, q) && Pl.friendAgeOk(w, p, q) && !family(w, p, q);
    for (const q of w.living) {
      if (!ok(q)) continue;
      if (p.job && q.job && p.job.place === q.job.place && out.work.length < 5) out.work.push(q);
      else if (sameSchool(w, p, q) && out.school.length < 5) out.school.push(q);
      else if (p.homeId >= 0 && w.town.buildings[q.homeId] && w.town.buildings[p.homeId] && Math.abs(w.town.buildings[q.homeId].x - w.town.buildings[p.homeId].x) + Math.abs(w.town.buildings[q.homeId].y - w.town.buildings[p.homeId].y) <= 8 && out.home.length < 5) out.home.push(q);
    }
    return out;
  };
  const sim = (p, q) => 1 - LES.C.PERS.reduce((t, k) => t + Math.abs(p.pers[k] - q.pers[k]), 0) / (100 * LES.C.PERS.length);
  const pay = w => Pl.typicalPay(w);

  Object.assign(Pl.HANDLERS, {
    MEET_ONLINE: {
      hours: 1, cooldown: 7, minAge: 13, key: () => 'online',
      check(w, p) { return (st(w).friends || []).length >= Pl.FRIENDS_MAX ? 'too_many' : null; },
      run(w, p) {
        const R = Pl.rng(w), pool = w.living.filter(q => here(q) && q !== p && !Pl.isFriend(w, q) && Pl.friendAgeOk(w, p, q) && !family(w, p, q)).map(q => [q, sim(p, q)]).sort((a, b) => (b[1] - a[1]) || (a[0].id - b[0].id)).slice(0, 6);
        st(w).played = true;
        if (!pool.length) return { code: 'no_match', params: {} };
        const [q, s] = pool[Math.floor(R.next() * pool.length)];
        if (R.next() >= U.clamp(0.35 + 0.3 * s + Pl.traitOdds(w, p, 'MAKE_FRIEND'), 0.1, 0.9)) return { code: 'quiet', params: {} };
        Pl.addFriend(w, q, 'online', 20); p.happy = Math.min(100, p.happy + 2);
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
    HANG_OUT: {
      hours: 3, cooldown: 3, key: a => `hang:${a.pid}`,
      check(w, p, a) { const q = w.people[a.pid]; return !Pl.isFriend(w, q) || !here(q) ? 'not_friend' : p.energy < 10 ? 'tired' : null; },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      cost(w, p) { return P.isAdult(w, p) ? Math.round(0.02 * pay(w)) : 0; },
      run(w, p, a) {
        const q = w.people[a.pid], R = Pl.rng(w), f = entry(w, q.id);
        st(w).played = true;
        if (R.next() >= U.clamp(0.7 + bond(w, q.id) / 400 - (q.stress > 70 ? 0.3 : 0), 0.2, 0.95)) return { code: 'busy', params: { other: P.name(q) } };
        const c = P.isAdult(w, p) ? Math.round(0.02 * pay(w)) : 0;
        if (c && p.cash > p.mcost) w.ledger.spend(p, 'cash', 'MERCHANT', c);
        setBond(w, q.id, bond(w, q.id) + 8); f.seen = w.day;
        p.happy = Math.min(100, p.happy + 3); p.stress = Math.max(0, p.stress - 3); p.energy -= 5;
        q.happy = Math.min(100, q.happy + 3); q.stress = Math.max(0, q.stress - 2);
        return { code: 'ok', params: { other: P.name(q), n: bond(w, q.id) } };
      },
    },
    HELP_FRIEND: {
      hours: 4, cooldown: 14, key: a => `help:${a.pid}`,
      check(w, p, a) { const q = w.people[a.pid]; return !Pl.isFriend(w, q) || !here(q) ? 'not_friend' : p.energy < 15 ? 'tired' : null; },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid];
        setBond(w, q.id, bond(w, q.id) + 10); entry(w, q.id).seen = w.day;
        q.stress = Math.max(0, q.stress - 8); q.happy = Math.min(100, q.happy + 3); p.energy -= 10; st(w).played = true;
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
    ASK_HELP: {
      hours: 1, cooldown: 30, adult: true, key: a => `askhelp:${a.pid}:${a.kind}`,
      check(w, p, a) {
        const q = w.people[a.pid];
        if (!Pl.isFriend(w, q) || !here(q)) return 'not_friend';
        if (a.kind === 'job') return !q.job || q.job.commuteTo !== undefined ? 'no_work' : !w.vacancies.some(v => v.place === q.job.place && P.hasCred(p, v.job.req) && !v.appSet.has(p.id) && !(p.job && p.job.salary >= v.salary)) ? 'no_opening' : null;
        if (a.kind === 'money') return (st(w).loans || []).some(l => l.left > 0) ? 'owing' : q.cash - 2 * q.mcost < w.px(100) ? 'cant' : null;
        return 'bad_args';
      },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], R = Pl.rng(w), s = st(w);
        s.played = true;
        if (R.next() >= U.clamp(0.25 + bond(w, q.id) / 140, 0.15, 0.9)) { setBond(w, q.id, bond(w, q.id) - 2); return { code: 'refused', params: { other: P.name(q) } }; }
        if (a.kind === 'job') {
          const v = w.vacancies.filter(x => x.place === q.job.place && P.hasCred(p, x.job.req) && !x.appSet.has(p.id) && !(p.job && p.job.salary >= x.salary)).sort((x, y) => (y.salary - x.salary) || (x.id - y.id))[0];
          v.applicants.push(p.id); v.appSet.add(p.id); p.energy -= 8;
          s.apps.push({ vac: v.id, jobId: v.job.id, title: v.job.title, salary: v.salary, day: w.day, closeDay: v.closeDay });
          s.referral = { vac: v.id, pid: q.id };
          return { code: 'ok_job', params: { other: P.name(q), job: v.job.title } };
        }
        const amt = Math.max(w.px(100), Math.min(Math.round(pay(w)), Math.round(q.cash - 2 * q.mcost)));
        w.ledger.move(q, 'cash', p, 'cash', amt);
        (s.loans = s.loans || []).push({ pid: q.id, amt, left: amt, monthly: Math.ceil(amt / 6), day: w.day });
        return { code: 'ok_money', params: { other: P.name(q), amt: U.fmtMoney(amt) } };
      },
    },
    INTRODUCE: {
      hours: 2, cooldown: 60, adult: true, key: a => `intro:${a.pid}`,
      check(w, p, a) { const q = w.people[a.pid]; return !Pl.isFriend(w, q) || !here(q) ? 'not_friend' : p.partnerId !== null ? 'has_partner' : !(Pl.singles && Pl.singles(w, p, 8).some(x => x !== q)) ? 'nobody' : null; },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], R = Pl.rng(w), list = Pl.singles(w, p, 8).filter(x => x !== q && !Pl.isFriend(w, x));
        st(w).played = true;
        if (!list.length || R.next() >= U.clamp(0.4 + bond(w, q.id) / 200, 0.2, 0.9)) return { code: 'refused', params: { other: P.name(q) } };
        const x = list[Math.floor(R.next() * Math.min(3, list.length))];
        st(w).introduced = { pid: x.id, day: w.day, by: q.id };
        return { code: 'ok', params: { other: P.name(q), person: P.name(x) } };
      },
    },
  });
  // A date with someone a friend introduced you to (in the last year) is a little likelier.
  Pl.introBonus = (w, q) => { const i = st(w) && st(w).introduced; return i && q && i.pid === q.id && w.day - i.day < 365 ? 0.1 : 0; };
  // A friend's word with their employer counts a little (labour.js asks; only the played character).
  Pl.referralFor = (w, p, v) => { const r = st(w) && st(w).id === p.id && st(w).referral; return r && r.vac === v.id ? 0.06 : 0; };
  Pl.TARGETS.friendPid = (w, p, item) => (item && item.params && item.params.pid >= 0 ? { pid: item.params.pid } : null);

  // Every month: friends you see anyway stay close; others drift; close friends ease stress; loans are repaid.
  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive || !s.friends) return;
    const keep = [];
    for (const f of s.friends) {
      const q = w.people[f.id];
      if (!q || !q.alive) { Pl.journal(w, { kind: 'life', key: 'fr.lost', params: { other: q ? P.name(q) : '' }, imp: 2 }); continue; }
      if (q.away) { Pl.journal(w, { kind: 'life', key: 'fr.moved', params: { other: P.name(q) }, imp: 1 }); continue; }
      if (sameWhere(w, p, q)) f.seen = w.day;
      else if (w.day - (f.seen || f.since) > 30) setBond(w, q.id, bond(w, q.id) - 2);
      if (bond(w, q.id) < 10) { Pl.journal(w, { kind: 'life', key: 'fr.drifted', params: { other: P.name(q) }, imp: 1 }); continue; }
      keep.push(f);
    }
    s.friends = keep;
    const close = keep.filter(f => bond(w, f.id) >= 70).length;
    if (close) { p.stress = Math.max(0, p.stress - Math.min(2, close)); p.happy = Math.min(100, p.happy + Math.min(1, 0.5 * close)); }
    for (const l of s.loans || []) {
      if (l.left <= 0) continue;
      const q = w.people[l.pid], m = Math.min(l.monthly, l.left);
      if (!q || !q.alive) { l.left = 0; continue; }
      if (p.cash - m > p.mcost && w.ledger.move(p, 'cash', q, 'cash', m)) { l.left -= m; if (l.left <= 0) Pl.journal(w, { kind: 'life', key: 'fr.repaid', params: { other: P.name(q) }, imp: 1 }); }
      else { setBond(w, q.id, bond(w, q.id) - 5); Pl.journal(w, { kind: 'life', key: 'fr.late', params: { other: P.name(q) }, imp: 1 }); }
    }
    s.loans = (s.loans || []).filter(l => l.left > 0);
  });

  // ---- Friends come to you: three moments (their effects are applied like every other moment) ----
  const pickFriend = (w, test) => { const l = Pl.friendList(w).filter(x => !test || test(x, w)); return l.length ? l[(w.day / 30 | 0) % l.length].q : null; };
  const NEWS = (x, w) => x.q.happy > 80 || (!!x.q.job && w.day - x.q.job.startDay < 60); // a friend's good news: happy, or a new job
  Object.assign(Pl.CONDITIONS, {
    friendClose: (w, p) => !!pickFriend(w, x => x.c >= 50),
    friendTrouble: (w, p) => !!pickFriend(w, x => x.q.stress > 70 || x.q.cash < x.q.mcost),
    friendNews: (w, p) => !!pickFriend(w, NEWS),
  });
  const named = test => (w, p) => { const q = pickFriend(w, test); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; };
  Object.assign(Pl.PARAMS, {
    friendClose: named(x => x.c >= 50),
    friendTrouble: named(x => x.q.stress > 70 || x.q.cash < x.q.mcost),
    friendNews: named(NEWS),
  });
  const FEV = (id, when, stages, choices, fx, o) => Object.assign({ id, stages, minAge: 6, maxAge: 120, when, chance: 0.25, cooldown: 180, expires: 14, imp: 1, params: when, choices }, o || {});
  Pl.EVENTS.push(
    FEV('FR-001', 'friendClose', ['child', 'teen', 'adult', 'senior'], [{ id: 'go', cmd: 'HANG_OUT', target: 'friendPid' }, { id: 'home', story: true }, { id: 'decline', story: true }]),
    FEV('FR-002', 'friendTrouble', ['teen', 'adult', 'senior'], [{ id: 'help', cmd: 'HELP_FRIEND', target: 'friendPid' }, { id: 'listen', story: true }, { id: 'distance', story: true }], null, { minAge: 13 }),
    FEV('FR-003', 'friendNews', ['child', 'teen', 'adult', 'senior'], [{ id: 'cheer', story: true }, { id: 'celebrate', cmd: 'HANG_OUT', target: 'friendPid' }, { id: 'envy', story: true }]),
  );
  Object.assign(Pl.MOMENT_FX = Pl.MOMENT_FX || {}, {
    'FR-001': [{ req: 'HANG_OUT', happy: 1 }, { bond: [['other', 4]], happy: 1, time: 2 }, { bond: [['other', -3]], energy: 4, stress: -1 }],
    'FR-002': [{ req: 'HELP_FRIEND', trait: ['kind'] }, { bond: [['other', 5]], their: [['other', 'stress', -3]], stress: 1, time: 1 }, { bond: [['other', -4]], stress: -1 }],
    'FR-003': [{ bond: [['other', 4]], their: [['other', 'happy', 2]], happy: 1 }, { req: 'HANG_OUT', rep: 1 }, { trait: ['ambitious'], stress: 2 }],
  });
})(globalThis.LES = globalThis.LES || {});
