// Play a Life (Playable Life Mode): the user takes over one real resident of the town.
// PL-02: choosing that resident. With the mode off (cfg.play absent or 'off') nothing here runs and no world
// gets a `player` field, so other worlds, saves and fingerprints are unchanged.
// Choosing never uses the world's random streams (its own stream: seed|play), so a played town is the same
// town as the unplayed one until the player's first decision (PL-03 onwards marks the world as played).
//
// cfg.play: 'off' | 'random' (a random resident, default when on) | 'cast' (cfg.playCast = a My Cast spec id,
// one of the founders); cfg.playStage: 'any' | baby | child | teen | adult | senior (for 'random').
// w.player = { id, how, since, chain: [{ id, day, how }], pending, nextId, journal, apps, inbox, played, rng }
(function (LES) {
  'use strict';
  const P = LES.P, U = LES.U;
  const Pl = LES.Player = {};
  // Life stages (ages in whole years): baby 0-2, child 3-11, teen 12-17, adult 18-59, senior 60+.
  Pl.STAGES = [['baby', 0], ['child', 3], ['teen', 12], ['adult', 18], ['senior', 60]];
  Pl.stageOf = age => { let s = 'baby'; for (const [k, a] of Pl.STAGES) if (age >= a) s = k; return s; };
  Pl.on = cfg => !!cfg && !!cfg.play && cfg.play !== 'off';

  // The town that holds the player (a World), or null. Works for one town or a region of towns.
  Pl.town = function (x) {
    if (!x) return null;
    const towns = x.towns || (x.region ? x.region.towns : null) || [x];
    return towns.find(t => t.player) || null;
  };
  Pl.person = w => (w && w.player && w.player.id >= 0 ? w.people[w.player.id] : null);

  function eligible(p, stage, w) { return p.alive && !p.away && !p.inst && (stage === 'any' || !stage || Pl.stageOf(Math.floor(P.age(w, p))) === stage); }

  // Pick the resident when a world (or region) is created. Returns { w, p, note } or { error }.
  Pl.begin = function (x) {
    const towns = x.towns || [x], cfg = (x.base || x.cfg);
    if (!Pl.on(cfg)) return null;
    let w = towns[0], p = null, note = '';
    // Start at Birth (PL-05): wait, watching the town, for its next real birth, then live that baby's life.
    if (cfg.play === 'random' && cfg.playStage === 'newborn') {
      w.player = { id: -1, waiting: 'birth', scan: w.people.length, how: 'birth', since: w.day, chain: [], pending: [], nextId: 1, journal: [], apps: [], inbox: [], played: false };
      return { w, p: null, note: '' };
    }
    if (cfg.play === 'cast' && cfg.playCast) {
      w = towns.find(t => t.playCastPid !== undefined) || null;
      p = w ? w.people[w.playCastPid] : null;
      if (!p) { w = towns[0]; note = 'Your character was not found; a random resident was chosen instead.'; }
    }
    if (!p) {
      const R = new LES.RNG(`${cfg.seed}|play`), stage = cfg.playStage || 'any';
      let pool = w.people.filter(q => eligible(q, stage, w));
      if (!pool.length) { pool = w.people.filter(q => eligible(q, 'any', w)); if (stage !== 'any') note = `Nobody in town is a ${stage} today; a resident of another age was chosen.`; }
      if (!pool.length) return { error: 'Nobody to play: the town is empty.' };
      p = pool[Math.floor(R.next() * pool.length)];
    }
    const how = p.custom && cfg.play === 'cast' ? 'cast' : 'random';
    w.player = { id: p.id, how, since: w.day, chain: [{ id: p.id, day: w.day, how }], pending: [], nextId: 1, journal: [], apps: [], inbox: [], played: false };
    return { w, p, note };
  };

  // What the badge and panels show about the controlled person.
  Pl.summary = function (w) {
    if (w && w.player && w.player.waiting) return { waiting: true, id: -1, name: '', age: 0, stage: 'baby', alive: true, away: false };
    const p = Pl.person(w);
    if (!p) return null;
    const age = Math.floor(P.age(w, p));
    return { id: p.id, name: P.name(p), age, stage: Pl.stageOf(age), alive: p.alive, away: !!p.away };
  };

  // ======================= PL-03: commands and events =======================
  // The player asks; the world decides. A request becomes an immutable command { id, kind, args, requestedDay,
  // status } in w.player.pending and is carried out once at the start of the next day (World.step, after God
  // Mode), re-checked then: alive, age, custody, target still there, time left today, cooldown. The result is a
  // code plus a translation key (cmd.<KIND>.<code>), kept in the journal as { key, params }. Nothing here creates
  // money or skills: each handler goes through the engine's own paths (a job application joins the vacancy's
  // applicants and the employer decides at closing time, exactly as for anyone else).
  // A world becomes "played" (w.player.played) with the first command that changes it.
  Pl.MONTHLY = []; // (w, p) => void, run every 30 days for the player (js/sim/player-child.js ...)
  Pl.DAILY = [];   // (w, p) => void, run every day (a trip ending, PL-11)
  Pl.DAY_HOURS = 8;   // time a player's requests may take per day
  Pl.STALE = 7;       // a request older than this many days is dropped, not carried out
  Pl.JOURNAL = 400;   // journal entries kept
  const GENERIC = new Set(['dead', 'away', 'held', 'stale', 'too_young', 'too_old', 'cooldown', 'no_time', 'travelling']); // messages shared by every kind (cmd.error.*)
  const st = w => w.player;
  const journal = (w, e) => { const j = st(w).journal; j.push(Object.assign({ day: w.day }, e)); if (j.length > Pl.JOURNAL) j.shift(); };
  Pl.journal = journal;
  const isAdult = (w, p) => P.isAdult(w, p);
  const whenOf = (w, v) => { const d = Math.max(0, v.closeDay - w.day); return d ? { key: 'time.inDays', params: { count: d } } : { key: 'time.today' }; };

  // Handlers: check(w, p, args) -> null when allowed, else a result code; run(w, p, args) -> { code, params }.
  Pl.HANDLERS = {
    // Apply for an open vacancy (args.vac = vacancy id). The employer's normal choice decides (Labour.award).
    APPLY_JOB: {
      hours: 4, cooldown: 0, adult: true,
      key: a => `vac:${a.vac}`,
      check(w, p, a) {
        const v = w.vacancies.find(x => x.id === a.vac);
        if (!v) return 'no_vacancy';
        if (v.appSet.has(p.id)) return 'already_applied';
        if (!P.hasCred(p, v.job.req)) return 'not_qualified';
        if (p.job && p.job.fixedTitle) return 'in_office';
        return null;
      },
      // Words for a refusal (e.g. your character's own routine had already applied: which job, when it is decided).
      params(w, p, a) { const v = w.vacancies.find(x => x.id === a.vac); return v ? { job: v.job.title, when: whenOf(w, v) } : {}; },
      run(w, p, a) {
        const v = w.vacancies.find(x => x.id === a.vac);
        v.applicants.push(p.id); v.appSet.add(p.id); p.energy -= 8; // as the autonomous APPLY action
        st(w).apps.push({ vac: v.id, jobId: v.job.id, title: v.job.title, salary: v.salary, day: w.day, closeDay: v.closeDay });
        st(w).played = true;
        return { code: 'ok', params: { job: v.job.title, pay: LES.U.fmtMoney(v.salary), when: whenOf(w, v) } };
      },
    },
  };

  // A baby or child reaches for their carer (PL-05). The carer decides: more likely when responsible, rested and
  // calm. If they come it is a real care session (Family.childMonth: care sessions feed the child's upbringing,
  // which shapes their abilities and character when they come of age) and costs the carer a little energy.
  Pl.carerOf = (w, p) => { const id = (p.caregivers || []).find(i => { const q = w.people[i]; return q && q.alive && !q.away && !q.inst; }); return id === undefined ? null : w.people[id]; };
  Pl.HANDLERS.ASK_CARE = {
    hours: 1, cooldown: 1, maxAge: 11,
    key: a => `care:${a.loud ? 1 : 0}`,
    check(w, p) { return p.guardian === 'WELFARE' ? 'welfare' : Pl.carerOf(w, p) ? null : 'no_carer'; },
    params(w, p) { const g = Pl.carerOf(w, p); return g ? { carer: P.name(g) } : {}; },
    run(w, p, a) {
      const g = Pl.carerOf(w, p), R = rng(w);
      const yes = U.clamp(0.35 + 0.5 * g.pers.resp / 100 + 0.25 * U.clamp(g.energy, 0, 100) / 100 - (g.stress > 70 ? 0.3 : 0) + (a.loud ? 0.1 : 0), 0.1, 0.95);
      if (R.next() >= yes) return { code: 'busy', params: { carer: P.name(g) } };
      p.careSessions = (p.careSessions || 0) + 1;
      g.energy -= 6; if (a.loud) g.stress = Math.min(100, g.stress + 3);
      st(w).played = true;
      return { code: 'ok', params: { carer: P.name(g) } };
    },
  };

  // Ask for something. Returns { command } or { error: code } (the code has a cmd.error.<code> message).
  Pl.request = function (w, kind, args) {
    const s = st(w);
    if (!s) return { error: 'not_playing' };
    const h = Pl.HANDLERS[kind];
    if (!h) return { error: 'unknown_kind' };
    const key = h.key ? h.key(args || {}) : '';
    if (s.pending.some(c => c.kind === kind && c.key === key)) return { error: 'duplicate' };
    const command = { id: `${w.townIdx || 0}-p${s.nextId++}`, kind, args: Object.assign({}, args), key, requestedDay: w.day, status: 'pending' };
    s.pending.push(command);
    return { command };
  };

  // Start of each day (World.step): commands, then outcomes, then (monthly) life events.
  Pl.tick = function (w) {
    const s = st(w);
    if (s.waiting) { awaitBirth(w); if (s.waiting) return; }
    const me = Pl.person(w);
    if (!s.ended && me && (!me.alive || me.away) && Pl.endLife) Pl.endLife(w, me); // PL-12: died or left town
    if (s.ended) return; // waiting for the next life to be chosen (or just watching)
    s.apps = s.apps || []; s.inbox = s.inbox || [];
    if (s.pending.length) runCommands(w);
    for (const f of Pl.DAILY) f(w, Pl.person(w));
    if (s.apps.length) outcomes(w);
    if (w.day % 30 === 0 && w.day > s.since) { for (const f of Pl.MONTHLY) f(w, Pl.person(w)); offerEvents(w); } // stage files add monthly effects (clubs, allowance, effort)
    expireInbox(w);
  };

  // Start at Birth: the first baby born in town since play began (newcomers' children do not count).
  function awaitBirth(w) {
    const s = st(w);
    for (let i = s.scan; i < w.people.length; i++) {
      const c = w.people[i];
      if (!c || !c.alive || c.migrant || c.away || c.birthDay < s.since || !c.parents.length) continue;
      const mum = w.people[c.parents.find(id => w.people[id].sex === 'F')] || w.people[c.parents[0]], dad = w.people[c.parents.find(id => id !== (mum && mum.id))];
      s.id = c.id; s.waiting = null; s.since = w.day; s.chain.push({ id: c.id, day: w.day, how: 'birth' });
      journal(w, { kind: 'life', key: 'life.born', params: { name: P.name(c), mother: mum ? P.name(mum) : '?', father: dad ? P.name(dad) : '?' }, imp: 2 });
      return;
    }
    s.scan = w.people.length;
  }

  function runCommands(w) {
    const s = st(w), p = Pl.person(w), todo = s.pending.splice(0);
    s.hours = s.hoursDay === w.day ? s.hours : 0; s.hoursDay = w.day;
    s.cool = s.cool || {};
    for (const c of todo) {
      const h = Pl.HANDLERS[c.kind];
      let code = !p || !p.alive ? 'dead' : p.away ? 'away' : p.inst ? 'held' : w.day - c.requestedDay > Pl.STALE ? 'stale' : s.trip && s.trip.until > w.day && c.kind !== 'TRAVEL' ? 'travelling'
        : (h.adult && !isAdult(w, p)) || (h.minAge !== undefined && P.age(w, p) < h.minAge) ? 'too_young' : h.maxAge !== undefined && P.age(w, p) >= h.maxAge + 1 ? 'too_old' : (s.cool[c.kind] || 0) > w.day ? 'cooldown' : s.hours + h.hours > Pl.DAY_HOURS ? 'no_time' : h.check(w, p, c.args);
      let params = code && h.params ? h.params(w, p, c.args) : {};
      if (!code) { const r = h.run(w, p, c.args); code = r.code; params = r.params || {}; s.hours += h.hours; if (h.cooldown) s.cool[c.kind] = w.day + h.cooldown; }
      c.status = code.startsWith('ok') ? 'done' : code === 'busy' || code === 'refused' ? 'declined' : 'rejected'; c.code = code; c.day = w.day;
      journal(w, { kind: 'cmd', cmd: c.kind, code, key: GENERIC.has(code) ? `cmd.error.${code}` : `cmd.${c.kind}.${code}`, params });
      s.done = s.done || []; s.done.push(c); if (s.done.length > 200) s.done.shift();
    }
  }

  // Applications whose vacancy has closed: hired, or someone else got it.
  function outcomes(w) {
    const s = st(w), p = Pl.person(w), open = new Set(w.vacancies.map(v => v.id));
    s.apps = s.apps.filter(a => {
      if (open.has(a.vac)) return true;
      if (!p || !p.alive) return false;
      const hired = p.job && p.job.jobId === a.jobId && p.job.startDay >= a.day && p.job.startDay <= w.day;
      journal(w, { kind: 'result', key: hired ? 'res.hired' : 'res.notHired', params: { job: a.title, pay: LES.U.fmtMoney(hired ? p.job.salary : a.salary) }, imp: hired ? 2 : 1 });
      return false;
    });
  }

  // ---- Life events: data records, checked monthly for the one player only ----
  // { id, stages, minAge, maxAge, when: condition name, chance, cooldown (days), expires (days),
  //   choices: [{ id, cmd?: kind, target?: target name, story?: true }] }
  // Conditions and targets are named functions below (content never runs code).
  // Helpers for the baby events (real people around the baby).
  const carer = (w, p) => Pl.carerOf(w, p);
  const sibNew = (w, p) => p.parents.flatMap(id => w.people[id].children).map(id => w.people[id]).find(c => c && c !== p && c.alive && c.birthDay > w.day - 30);
  const toddler = (w, p) => { const near = w.living.filter(c => c.alive && c !== p && !c.away && P.age(w, c) >= 1 && P.age(w, c) < 4 && !p.parents.some(id => c.parents.includes(id))); return near.length ? near[(w.day / 30 | 0) % near.length] : null; };
  Pl.CONDITIONS = {
    hasCarer: (w, p) => !!carer(w, p),
    newSibling: (w, p) => !!carer(w, p) && !!sibNew(w, p),
    carerChanged: (w, p) => { const s = st(w), key = (p.caregivers || []).join(',') + (p.guardian || ''); const was = s.carers; s.carers = key; return was !== undefined && was !== key; },
    carerStressed: (w, p) => { const g = carer(w, p); return !!g && g.stress > 70; },
    carerWorks: (w, p) => { const g = carer(w, p); return !!g && !!g.job; },
    unwell: (w, p) => p.health < 75 && !!carer(w, p),
    talking: (w, p) => P.age(w, p) >= 1 && !!carer(w, p),
    toddlerNear: (w, p) => !!toddler(w, p),
    moneyTight: (w, p) => { const g = carer(w, p); return !!g && g.cash < g.mcost; },
    seekingWork: (w, p) => !p.job && !p.enrol && !p.retired && p.manages < 0 && Pl.openings(w, p, true).length > 0,
  };
  // Words for an event card: the real people in it.
  Pl.PARAMS = {
    carer: (w, p) => { const g = carer(w, p); return { carer: g ? P.name(g) : '' }; },
    sibling: (w, p) => { const c = sibNew(w, p), g = carer(w, p); return { sibling: c ? c.first : '', carer: g ? P.name(g) : '' }; },
    toddler: (w, p) => { const c = toddler(w, p), g = carer(w, p); return { other: c ? P.name(c) : '', carer: g ? P.name(g) : '' }; },
  };
  Pl.TARGETS = {
    care: () => ({}),
    careLoud: () => ({ loud: true }),
    // Jobs not yet applied for first; if your character's routine already applied everywhere, the reply says so.
    bestPaid: (w, p) => { const o = pref(w, p); return o.length ? { vac: o[0].id } : null; },
    typicalPay: (w, p) => { const o = pref(w, p); return o.length ? { vac: o[Math.floor(o.length / 2)].id } : null; },
  };
  Pl.EVENTS = [
    { id: 'AD-001', stages: ['adult'], minAge: 18, maxAge: 35, when: 'seekingWork', chance: 0.6, cooldown: 120, expires: 20, imp: 2,
      choices: [{ id: 'stable', cmd: 'APPLY_JOB', target: 'typicalPay' }, { id: 'ambitious', cmd: 'APPLY_JOB', target: 'bestPaid' }, { id: 'training', story: true }] },
  ];
  // Baby (0-2): the baby signals; the carer decides (ASK_CARE). Quiet choices are the baby's own (story only).
  const baby = (id, when, choices, o) => Object.assign({ id, stages: ['baby'], minAge: 0, maxAge: 2, when, chance: 0.35, cooldown: 150, expires: 10, imp: 1, params: 'carer', choices }, o || {});
  const ask = id => ({ id, cmd: 'ASK_CARE', target: 'care' }), cry = id => ({ id, cmd: 'ASK_CARE', target: 'careLoud' }), story = id => ({ id, story: true });
  Pl.EVENTS.push(
    baby('BA-002', 'hasCarer', [ask('reach'), story('toy'), cry('cry')], { chance: 0.25 }),
    baby('BA-004', 'newSibling', [story('reach'), ask('attention'), story('watch')], { chance: 0.9, params: 'sibling', imp: 2 }),
    baby('BA-006', 'carerChanged', [story('routine'), story('investigate'), cry('signal')], { chance: 1, imp: 2 }),
    baby('BA-008', 'carerStressed', [ask('contact'), story('quiet'), story('withdraw')], { chance: 0.5 }),
    baby('BA-010', 'carerWorks', [story('excited'), ask('cuddle'), story('play')], { chance: 0.25 }),
    baby('BA-012', 'unwell', [ask('rest'), story('quietPlay'), cry('signal')], { chance: 0.8, imp: 2, cooldown: 60 }),
    baby('BA-023', 'talking', [story('greet'), story('name'), story('animal')], { chance: 0.5, minAge: 1, cooldown: 400 }),
    baby('BA-032', 'toddlerNear', [story('wave'), story('offer'), ask('stay')], { chance: 0.3, minAge: 1, params: 'toddler' }),
    baby('BA-044', 'moneyTight', [story('share'), ask('cuddles'), story('outdoor')], { chance: 0.5 }),
  );
  Pl.eventById = id => Pl.EVENTS.find(e => e.id === id);
  // How often life events come (the player's choice; it only changes which events are offered): important ones
  // only (imp 2: work, family, money turning points), balanced, or detailed (more small moments).
  Pl.FREQ = { important: { mult: 1, minImp: 2 }, balanced: { mult: 1, minImp: 1 }, detailed: { mult: 1.5, minImp: 1 } };

  // Vacancies this person could apply for, best paid first (all: including ones they already applied for).
  Pl.openings = (w, p, all) => w.vacancies.filter(v => (all || !v.appSet.has(p.id)) && P.hasCred(p, v.job.req) && !(p.job && p.job.salary >= v.salary)).sort((a, b) => (b.salary - a.salary) || (a.id - b.id));
  const pref = (w, p) => { const o = Pl.openings(w, p); return o.length ? o : Pl.openings(w, p, true); };

  const rng = w => (st(w).rng = st(w).rng || new LES.RNG(`${w.cfg.seed}|play|events`)); // never the world's dice
  Pl.rng = rng;
  function offerEvents(w) {
    const s = st(w), p = Pl.person(w);
    if (!p || !p.alive || p.away) return;
    s.inbox = s.inbox || []; s.evCool = s.evCool || {};
    const age = Math.floor(P.age(w, p)), stage = Pl.stageOf(age), R = rng(w);
    const cands = [];
    for (const e of Pl.EVENTS) {
      if (!e.stages.includes(stage) || age < e.minAge || age > e.maxAge || (s.evCool[e.id] || 0) > w.day || s.inbox.some(x => x.ev === e.id)) continue;
      if ((e.mature && !s.mature) || (e.sensitive && s.noSensitive)) continue; // content settings (the player's own dice only)
      const cond = Pl.CONDITIONS[e.when];
      if (cond && !cond(w, p)) continue;
      const f = Pl.FREQ[s.freq || 'balanced'] || Pl.FREQ.balanced;
      if ((e.imp || 1) < f.minImp) continue;
      if (R.next() >= e.chance * f.mult) continue;
      cands.push(e);
    }
    // At most one new event a month (no pile of pop-ups): important ones first, then one at random.
    if (!cands.length) return;
    const top = Math.max(...cands.map(e => e.imp || 1)), pool = cands.filter(e => (e.imp || 1) === top), e = pool[Math.floor(R.next() * pool.length)];
    s.inbox.push({ uid: `${w.day}-${e.id}`, ev: e.id, day: w.day, expires: w.day + e.expires, params: e.params && Pl.PARAMS[e.params] ? Pl.PARAMS[e.params](w, p) : {} });
    s.evCool[e.id] = w.day + e.cooldown;
    journal(w, { kind: 'event', ev: e.id, key: 'evt.offered', params: { title: { key: `ev.${e.id}.title`, params: s.inbox[s.inbox.length - 1].params } }, imp: e.imp || 1 });
  }
  // Unanswered events pass: nothing is done for you (your character's own routine carries on).
  function expireInbox(w) {
    const s = st(w);
    if (!s.inbox || !s.inbox.length) return;
    s.inbox = s.inbox.filter(x => { if (x.expires > w.day) return true; journal(w, { kind: 'pass', ev: x.ev, key: 'evt.passed', params: { title: { key: `ev.${x.ev}.title`, params: x.params || {} } } }); return false; });
  }

  // Let your character decide: the event closes now and their own routine carries on.
  Pl.pass = function (w, uid) {
    const s = st(w), item = s && (s.inbox || []).find(x => x.uid === uid);
    if (!item) return false;
    s.inbox = s.inbox.filter(x => x !== item);
    journal(w, { kind: 'pass', ev: item.ev, key: 'evt.delegated', params: { title: { key: `ev.${item.ev}.title`, params: item.params || {} } } });
    return true;
  };
  // Answer an event. Returns { command } | { story: true } | { error }.
  Pl.choose = function (w, uid, choiceId) {
    const s = st(w), item = s && (s.inbox || []).find(x => x.uid === uid), e = item && Pl.eventById(item.ev), ch = e && e.choices.find(c => c.id === choiceId);
    if (!ch) return { error: 'no_choice' };
    s.inbox = s.inbox.filter(x => x !== item);
    journal(w, { kind: 'choice', ev: e.id, choice: ch.id, key: 'evt.chose', params: { choice: { key: `ev.${e.id}.${ch.id}`, params: item.params || {} } } });
    if (ch.story) return { story: true };
    const p = Pl.person(w), args = ch.target ? Pl.TARGETS[ch.target](w, p, item) : {};
    if (!args) { journal(w, { kind: 'cmd', code: 'no_target', key: 'cmd.error.no_target', params: {} }); return { error: 'no_target' }; }
    return Pl.request(w, ch.cmd, args);
  };
})(globalThis.LES = globalThis.LES || {});
