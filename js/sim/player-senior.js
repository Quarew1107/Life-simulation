// Play a Life (PL-12): seniors, and what happens when the life you are playing ends.
// - RETIRE: from 55 (the engine retires people from 60, earlier for those who planned it). KEEP_WORKING: past
//   the usual age, keep working (the engine's yearly retirement roll skips the player; a job with statutory
//   retirement in China still ends at the legal age; everyone stops at 70).
// - When the player dies (the engine's normal death, estate and inheritance, untouched) or leaves town, control
//   ends: commands still waiting are cancelled with one receipt each (no payment), unanswered decisions close,
//   and the succession choice appears (design 06, section 7):
//     1. a living child or grandchild in town (the option is missing if there is none);
//     2. a random living resident (the player's own dice: seed|play|succ|n), kept once chosen;
//     3. any living resident, searched by name;
//     4. watch only (spectator): the town carries on by itself; you can still take someone over later.
//   Nothing is handed over: the new person keeps only what they really have (inheritance came through the
//   engine's estate rules). The journal keeps every life; w.player.chain lists who was played and how.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  const here = q => q && q.alive && !q.away;

  Object.assign(Pl.HANDLERS, {
    RETIRE: {
      hours: 2, cooldown: 30, adult: true, minAge: 55, key: () => 'retire',
      check(w, p) { return p.retired ? 'already' : p.job && p.job.fixedTitle ? 'in_office' : null; },
      run(w, p) {
        p.retired = true; st(w).keepWorking = false; st(w).played = true;
        const t = p.job ? p.job.title : '';
        if (p.job) LES.Labour.endJob(w, p, 'retired');
        P.log(w, p, `Retired at age ${Math.floor(P.age(w, p))}`, 'career', 0);
        return { code: t ? 'ok' : 'ok_nojob', params: { job: t, age: Math.floor(P.age(w, p)) } };
      },
    },
    KEEP_WORKING: {
      hours: 0, cooldown: 0, adult: true, minAge: 50, key: () => 'keep',
      check(w, p) { return p.retired ? 'retired' : !p.job ? 'no_job' : null; },
      run(w, p) { st(w).keepWorking = true; st(w).played = true; return { code: 'ok', params: {} }; },
    },
  });
  // Labour.yearClose asks this before its retirement roll.
  Pl.keepsWorking = (w, p, age, statutory) => !!(w.player && w.player.id === p.id && w.player.keepWorking && !statutory && age < 70);

  // ---- The end of a life, and who comes next ----
  const LIFE_KEYS = ['dating', 'married', 'coupled', 'lastPartner', 'babyWish', 'affair', 'school', 'schoolBoost', 'boost', 'club', 'allowance', 'friends', 'effort',
    'plan', 'homeTier', 'stand', 'ran', 'hadJob', 'jobLost', 'quitDay', 'noJobSince', 'idxPeak', 'kidSchools', 'kidBoost', 'askedSchool', 'carers', 'volunteered',
    'trip', 'exercise', 'lowMonths', 'stressMonths', 'keepWorking', 'evCool', 'cool', 'hours', 'hoursDay'];
  Pl.endLife = function (w, p) {
    const s = st(w);
    s.ended = { day: w.day, id: p.id, why: p.alive ? 'away' : 'died', age: Math.floor(P.age(w, p)) };
    for (const c of s.pending.splice(0)) { // one receipt each, nothing carried out or paid
      c.status = 'rejected'; c.code = p.alive ? 'away' : 'dead'; c.day = w.day;
      Pl.journal(w, { kind: 'cmd', cmd: c.kind, code: c.code, key: `cmd.error.${c.code}`, params: {} });
    }
    s.inbox = []; s.apps = [];
    Pl.journal(w, { kind: 'life', key: p.alive ? 'life.leftTown' : 'life.died', params: { name: P.name(p), age: s.ended.age, cause: p.causeOfDeath || '' }, imp: 2 });
  };
  // Children and grandchildren living in this town.
  Pl.heirs = function (w) {
    const s = st(w), p = s && w.people[s.ended ? s.ended.id : s.id];
    if (!p) return [];
    const kids = p.children.map(id => w.people[id]), grand = kids.flatMap(c => (c ? c.children : [])).map(id => w.people[id]);
    return kids.concat(grand).filter((q, i, a) => here(q) && a.indexOf(q) === i);
  };
  Pl.randomHeir = function (w) {
    const s = st(w), pool = w.living.filter(q => here(q) && !q.inst && q.id !== (s.ended && s.ended.id));
    if (!pool.length) return null;
    const R = new LES.RNG(`${w.cfg.seed}|play|succ|${s.chain.length}`);
    return pool[Math.floor(R.next() * pool.length)];
  };
  Pl.search = (w, text, n) => { const t = String(text || '').trim().toLowerCase(); return t.length < 2 ? [] : w.living.filter(q => here(q) && P.name(q).toLowerCase().includes(t)).slice(0, n || 10); };
  // Take over a new life. how: 'heir' | 'random' | 'chosen'. Returns an error code or null.
  Pl.succeed = function (w, pid, how) {
    const s = st(w), q = w.people[pid];
    if (!s || !s.ended) return 'not_ended';
    if (!here(q)) return 'not_available';
    if (how === 'heir' && !Pl.heirs(w).includes(q)) return 'not_heir';
    for (const k of LIFE_KEYS) delete s[k];
    s.pending = []; s.inbox = []; s.apps = [];
    s.id = q.id; s.since = w.day; s.how = how; s.ended = null; s.spectator = false;
    s.chain.push({ id: q.id, day: w.day, how });
    Pl.journal(w, { kind: 'life', key: `life.next.${how}`, params: { name: P.name(q), age: Math.floor(P.age(w, q)) }, imp: 2 });
    return null;
  };
  Pl.spectate = w => { const s = st(w); if (s && s.ended) s.spectator = true; };

  // ---- Senior events ----
  const pick = (w, list) => (list.length ? list[(w.day / 30 | 0) % list.length] : null);
  const kids = (w, p) => p.children.map(id => w.people[id]).filter(q => here(q) && P.isAdult(w, q));
  const grand = (w, p, lo, hi) => p.children.flatMap(id => w.people[id].children).map(id => w.people[id]).filter(q => here(q) && P.age(w, q) >= lo && P.age(w, q) < hi);
  const jobless = (w, p) => pick(w, kids(w, p).filter(q => !q.job && !q.enrol && !q.retired && q.manages < 0 && P.age(w, q) < 60));
  const schoolParent = (w, p) => pick(w, kids(w, p).filter(q => q.careOf.some(id => { const c = w.people[id]; return c.alive && P.age(w, c) >= 10 && P.age(w, c) < 17; })));
  Object.assign(Pl.CONDITIONS, {
    retireAge: (w, p) => !!p.job && !p.retired && !p.job.fixedTitle && P.age(w, p) >= 59 && !st(w).keepWorking,
    grandTeen: (w, p) => grand(w, p, 10, 18).length > 0,
    childJobless: (w, p) => !!jobless(w, p),
    grandSchool: (w, p) => !!schoolParent(w, p) && p.cash > 6 * p.mcost,
    retiredActive: (w, p) => !!p.retired,
    lonely: (w, p) => !!p.retired && p.partnerId === null && p.happy < 55,
    reunion: (w, p) => kids(w, p).length >= 2,
    legacy: (w, p) => P.age(w, p) >= 70 && p.cash > 12 * p.mcost,
  });
  Object.assign(Pl.PARAMS, {
    grandTeen: (w, p) => { const q = pick(w, grand(w, p, 10, 18)); return { other: q ? q.first : '', pid: q ? q.id : -1 }; },
    childJobless: (w, p) => { const q = jobless(w, p); return { other: q ? q.first : '', pid: q ? q.id : -1 }; },
    grandSchool: (w, p) => { const q = schoolParent(w, p); return { other: q ? q.first : '', pid: q ? q.id : -1 }; },
    reunion: (w, p) => { const q = pick(w, kids(w, p)); return { count: kids(w, p).length, pid: q ? q.id : -1, other: q ? q.first : '' }; },
  });
  Object.assign(Pl.TARGETS, {
    retire: () => ({}), keep: () => ({}),
    personGift: (w, p, item) => (item && item.params && item.params.pid >= 0 ? { pid: item.params.pid, share: 0.2 } : null),
    personVisit: (w, p, item) => (item && item.params && item.params.pid >= 0 ? { pid: item.params.pid } : null),
    legacyGift: (w, p) => ({ amt: Math.round(Math.max(0, p.cash - 12 * p.mcost) * 0.1) || 1 }),
  });
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['senior'], minAge: 60, maxAge: 120, when, chance: 0.3, cooldown: 360, expires: 20, imp: 1, choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('SE-001', 'retireAge', [cmd('now', 'RETIRE', 'retire'), story('parttime'), cmd('continue', 'KEEP_WORKING', 'keep')], { stages: ['adult', 'senior'], minAge: 59, chance: 0.8, cooldown: 300, imp: 2 }),
    ev('SE-011', 'grandTeen', [cmd('share', 'VISIT', 'personVisit'), cmd('ask', 'VISIT', 'personVisit'), story('mentor')], { params: 'grandTeen' }),
    ev('SE-012', 'childJobless', [cmd('help', 'GIFT', 'personGift'), story('network'), story('support')], { params: 'childJobless', chance: 0.5, imp: 2 }),
    ev('SE-015', 'grandSchool', [cmd('pay', 'GIFT', 'personGift'), story('tutor'), story('save')], { params: 'grandSchool', chance: 0.25, cooldown: 540 }),
    ev('SE-023', 'retiredActive', [story('club'), cmd('volunteer', 'VOLUNTEER', 'volunteer'), cmd('neighbours', 'VISIT', 'trusted')], { chance: 0.25 }),
    ev('SE-026', 'lonely', [cmd('programme', 'VOLUNTEER', 'volunteer'), cmd('reconnect', 'VISIT', 'trusted'), cmd('counselling', 'COUNSELLING', 'counselling')], { chance: 0.4, imp: 2, cooldown: 240 }),
    ev('SE-018', 'reunion', [cmd('host', 'VISIT', 'personVisit'), story('online'), cmd('smaller', 'VISIT', 'personVisit')], { params: 'reunion', chance: 0.2, cooldown: 720 }),
    ev('SE-045', 'legacy', [story('bequest'), cmd('donate', 'DONATE', 'legacyGift'), story('family')], { minAge: 70, chance: 0.2, cooldown: 1080 }),
  );
})(globalThis.LES = globalThis.LES || {});
