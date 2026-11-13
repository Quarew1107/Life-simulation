// Play a Life: how a life flows (owner's plan, Nov 14 2026).
// 1. Plans that can really happen: Player.check(w, kind, args) answers before a request is queued, with the
//    same rules the request meets tomorrow (alive, here, age, waiting period, away on a trip, the handler's own
//    checks) plus the day's time (8 hours minus what is already planned) and money (cash minus the cost of the
//    other plans). Player.plan() queues only what passes; the UI greys out the rest with the reason.
// 2. Two kinds of decisions: important ones (imp 2) wait for the player (the UI stops the clock); everyday ones
//    (imp 1) are decided by the character at fast speeds (w.player.autoMinor, set by the UI): Player.autoChoice
//    scores each choice from personality, wishes, stress and money, and picks with the player's own dice.
// 3. Life moments: Player.DAILY notices big changes in the played life (a wedding, a child, a degree...) and
//    records them (w.player.moments, journal kind 'moment'); the UI celebrates the big ones.
// 4. A life goal the player can choose (the engine's own goals, which change how residents behave), and a mood
//    line from the person's real state.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  const M = w => Pl.typicalPay(w);

  // ---- 1. What each request costs the player tomorrow (sen); 0 when it is paid later or from a share of spare cash.
  const COSTS = {
    ASK_DATE: w => Math.round(0.05 * M(w)),
    PROPOSE: (w, p, a) => Math.round((a.kind === 'civil' ? 0.5 : 1.5) * M(w)),
    COUNSEL: w => Math.round(0.05 * M(w)),
    COUNSELLING: w => Math.round(0.05 * M(w)),
    SEE_DOCTOR: w => w.px(60),
    TRAVEL: (w, p, a) => (Pl.TRIPS[a.kind] ? Pl.tripCost(w, a.kind) : 0),
    BUY_STOCK: (w, p, a) => (Pl.unitPrice(w, a.tk) && a.shares > 0 ? Pl.buyCost(w, a.tk, a.shares) : 0),
    BUY_TICKET: w => Pl.ticket(w),
    DONATE: (w, p, a) => (a.amt > 0 ? Math.round(a.amt) : 0),
  };
  Pl.costOf = (w, p, kind, args) => (COSTS[kind] ? COSTS[kind](w, p, args || {}) : 0);
  const busyHours = s => s.pending.reduce((t, c) => t + ((Pl.HANDLERS[c.kind] || {}).hours || 0), 0);
  const busyMoney = (w, p) => st(w).pending.reduce((t, c) => t + Pl.costOf(w, p, c.kind, c.args), 0);
  // Could this be done tomorrow? { ok, code, hours, cost, hoursLeft, cashLeft } (code = why not; texts cmd.error.* or cmd.<KIND>.*).
  Pl.check = function (w, kind, args) {
    const s = st(w), h = Pl.HANDLERS[kind], p = Pl.person(w), a = args || {};
    if (!s || !h) return { ok: false, code: 'unknown_kind' };
    const hours = h.hours || 0, cost = p ? Pl.costOf(w, p, kind, a) : 0;
    const hoursLeft = Pl.DAY_HOURS - busyHours(s), cashLeft = p ? p.cash - busyMoney(w, p) : 0;
    const out = { ok: false, hours, cost, hoursLeft, cashLeft };
    const key = h.key ? h.key(a) : '';
    let code = s.ended || s.waiting ? 'not_playing' : !p || !p.alive ? 'dead' : p.away ? 'away' : p.inst ? 'held'
      : (h.adult && !P.isAdult(w, p)) || (h.minAge !== undefined && P.age(w, p) < h.minAge) ? 'too_young' : h.maxAge !== undefined && P.age(w, p) >= h.maxAge + 1 ? 'too_old'
      : (s.cool && (s.cool[kind] || 0) > w.day) ? 'cooldown' : s.trip && s.trip.until > w.day && kind !== 'TRAVEL' ? 'travelling'
      : s.pending.some(c => c.kind === kind && c.key === key) ? 'duplicate' : hours > hoursLeft ? 'no_time' : cost > 0 && cost > cashLeft ? 'no_money' : null;
    if (!code) { try { code = h.check(w, p, a); } catch (e) { code = 'bad_args'; } }
    out.code = code; out.ok = !code;
    return out;
  };
  // The reason in words (the generic messages, or the request's own).
  Pl.whyNot = function (w, kind, args, r) {
    const GEN = ['not_playing', 'dead', 'away', 'held', 'too_young', 'too_old', 'cooldown', 'travelling', 'duplicate', 'no_time', 'no_money', 'unknown_kind'];
    if (GEN.includes(r.code)) return { key: `plan.${r.code}`, params: { hours: r.hours, left: Math.max(0, r.hoursLeft), cost: U.fmtMoney(r.cost), cash: U.fmtMoney(Math.max(0, r.cashLeft)) } };
    const h = Pl.HANDLERS[kind], p = Pl.person(w);
    let ps = {};
    try { ps = h && h.params && p ? h.params(w, p, args || {}) || {} : {}; } catch (e) { ps = {}; }
    return { key: `cmd.${kind}.${r.code}`, params: ps };
  };
  // Queue only what can happen: returns { command } or { error, why }.
  Pl.plan = function (w, kind, args) {
    const r = Pl.check(w, kind, args);
    if (!r.ok) return { error: r.code, why: Pl.whyNot(w, kind, args, r) };
    return Pl.request(w, kind, args);
  };

  // ---- 2. Important and everyday decisions ----
  // Important: the player decides (the clock stops). Everyday: the character decides at fast speeds.
  Pl.IMPORTANT = new Set(['BA-004', 'BA-006', 'BA-012', 'BA-023', 'CH-001', 'CH-004', 'CH-006', 'CH-009', 'CH-015', 'CH-016', 'CH-031', 'CH-032',
    'TE-001', 'TE-003', 'TE-006', 'TE-008', 'TE-024', 'TE-038', 'AD-001', 'AD-003', 'AD-004', 'AD-007', 'AD-008', 'AD-022', 'AD-026', 'AD-061', 'AD-101',
    'AD-031', 'AD-032', 'AD-035', 'AD-036', 'AD-037', 'AD-040', 'AD-041', 'AD-044', 'AD-045', 'AD-047', 'AD-011', 'AD-014', 'AD-072', 'AD-091',
    'AD-053', 'AD-058', 'AD-094', 'AD-064', 'AD-097', 'SE-001', 'SE-012', 'SE-015', 'SE-026', 'SE-045']);
  for (const e of Pl.EVENTS) e.imp = Pl.IMPORTANT.has(e.id) ? 2 : 1;
  Pl.isImportant = item => { const e = item && Pl.eventById(item.ev); return !!e && (e.imp || 1) >= 2; };
  Pl.urgent = w => (st(w) && st(w).inbox ? st(w).inbox.find(Pl.isImportant) || null : null); // an important decision waiting

  // The character's own choice: each choice scored from who they are and how things are, then a soft pick
  // (temperature 0.35) on the player's dice. Never: affairs, leaving a partner or job, closing a business.
  const NEVER = new Set(['AFFAIR', 'SEPARATE', 'QUIT_JOB', 'CLOSE_BIZ', 'SELL_BIZ', 'RETIRE', 'DROP_OUT']);
  const KIND = {
    social: ['ASK_DATE', 'ASK_PARTNER', 'MAKE_FRIEND', 'WELCOME', 'VISIT', 'PROPOSE', 'STAND'],
    risky: ['BUY_TICKET', 'TRAVEL', 'START_BIZ', 'INVEST', 'BUY_STOCK', 'INJECT', 'ASK_RAISE', 'MOVE_HOME'],
    study: ['ENROLL', 'ASK_CLUB', 'SET_EFFORT', 'ASK_SCHOOL', 'CHOOSE_SCHOOL', 'SET_PLAN', 'APPLY_JOB'],
    caring: ['CARE_CHILD', 'ASK_CARE', 'GIFT', 'DONATE', 'VOLUNTEER', 'COUNSEL', 'BABY_WISH', 'KEEP_WORKING'],
    rest: ['REST', 'COUNSELLING', 'SEE_DOCTOR', 'SET_EXERCISE'],
    careful: ['SELL', 'SELL_STOCK', 'ASK_ALLOWANCE', 'STOP_SPENDING'],
  };
  const groupOf = k => Object.keys(KIND).find(g => KIND[g].includes(k)) || 'other';
  Pl.autoChoice = function (w, item) {
    const p = Pl.person(w), e = item && Pl.eventById(item.ev);
    if (!p || !e) return null;
    const n = v => (v || 50) / 100, money = U.clamp(p.cash / Math.max(1, 3 * p.mcost), 0, 1);
    const cands = [];
    for (const ch of e.choices) {
      let s, why;
      if (ch.story) { s = 0.35 + 0.35 * (1 - n(p.pers.risk)); why = 'steady'; }
      else {
        if (NEVER.has(ch.cmd)) continue;
        const args = ch.target ? Pl.TARGETS[ch.target](w, p, item) : {};
        if (!args || !Pl.check(w, ch.cmd, args).ok) continue;
        const g = groupOf(ch.cmd);
        if (g === 'social') { s = 0.3 + 0.5 * U.clamp(p.att[C.CHA] / 10, 0, 1) + 0.2 * n(p.famDesire); why = 'social'; }
        else if (g === 'risky') { s = 0.15 + 0.6 * n(p.pers.risk) + 0.25 * money; why = 'bold'; }
        else if (g === 'study') { s = 0.25 + 0.5 * n(p.pers.dis) + 0.25 * U.clamp(p.att[C.INT] / 10, 0, 1); why = 'driven'; }
        else if (g === 'caring') { s = 0.3 + 0.6 * n(p.pers.resp); why = 'caring'; }
        else if (g === 'rest') { s = 0.2 + 0.6 * p.stress / 100 + 0.4 * (100 - p.health) / 100; why = 'tired'; }
        else if (g === 'careful') { s = 0.25 + 0.45 * (1 - n(p.pers.risk)) + 0.3 * (1 - money); why = 'careful'; }
        else { s = 0.45; why = 'steady'; }
      }
      cands.push({ ch, s, why });
    }
    if (!cands.length) return null;
    const R = Pl.rng(w), mx = Math.max(...cands.map(c => c.s)), ex = cands.map(c => Math.exp((c.s - mx) / 0.35)), tot = ex.reduce((a, b) => a + b, 0);
    let r = R.next() * tot;
    for (let i = 0; i < cands.length; i++) { r -= ex[i]; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  };
  // The character decides this one (everyday decisions at fast speed, or "Let them decide").
  Pl.autoDecide = function (w, uid) {
    const s = st(w), item = s && (s.inbox || []).find(x => x.uid === uid), p = Pl.person(w);
    if (!item || !p) return false;
    const pick = Pl.autoChoice(w, item);
    if (!pick) return Pl.pass(w, uid);
    Pl.journal(w, { kind: 'auto', ev: item.ev, key: 'evt.auto', params: { name: p.first, choice: { key: `ev.${item.ev}.${pick.ch.id}`, params: item.params || {} }, why: { key: `why.${pick.why}` } } });
    Pl.choose(w, uid, pick.ch.id, true);
    return true;
  };
  // Every day: at fast speeds the character settles the everyday decisions themself.
  Pl.AFTER.push(function (w) {
    const s = st(w);
    if (!s.autoMinor || !s.inbox || !s.inbox.length) return;
    for (const item of s.inbox.slice()) if (!Pl.isImportant(item)) Pl.autoDecide(w, item.uid);
  });

  // ---- 3. Life moments ----
  // big: the UI slows to 1x and shows a card; small: a toast. Sounds: the town's bells.
  Pl.MOMENTS = {
    born: { big: true, sound: 'baby' }, school: { big: true }, schoolDone: { big: true }, graduated: { big: true }, firstJob: { big: true }, newJob: { big: false },
    promoted: { big: false }, together: { big: true }, married: { big: true, sound: 'wedding' }, child: { big: true, sound: 'baby' }, grandchild: { big: true, sound: 'baby' },
    business: { big: true }, elected: { big: true }, retired: { big: true }, lost: { big: true, sound: 'funeral' }, birthday: { big: false }, home: { big: false }, jackpot: { big: true },
  };
  Pl.moment = function (w, kind, params) {
    const s = st(w), m = { kind, day: w.day, params: params || {}, big: !!(Pl.MOMENTS[kind] || {}).big, sound: (Pl.MOMENTS[kind] || {}).sound || null, seq: (s.momentSeq = (s.momentSeq || 0) + 1) };
    s.moments = s.moments || []; s.moments.push(m); if (s.moments.length > 60) s.moments.shift();
    Pl.journal(w, { kind: 'moment', moment: kind, key: `moment.${kind}`, params: m.params, imp: m.big ? 2 : 1 });
    return m;
  };
  const snap = (w, p) => {
    const fam = p.parents.concat(p.children, p.partnerId !== null ? [p.partnerId] : []);
    const grand = p.children.flatMap(id => w.people[id].children);
    return {
      partner: p.partnerId, married: st(w).married ? st(w).married.pid : null, kids: p.children.length, grand: grand.length, quals: p.quals.slice(), job: p.job ? `${p.job.jobId}@${p.job.biz}` : null,
      level: p.job ? p.job.level : 0, retired: !!p.retired, biz: p.manages, elected: !!(w.gov && w.gov.president === p.id), age: Math.floor(P.age(w, p)),
      alive: fam.filter(id => w.people[id].alive).map(String), home: p.tiers.housing, worked: !!(st(w).snap && st(w).snap.worked) || !!p.job, nw: p.nw,
    };
  };
  Pl.DAILY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive || s.ended) return;
    const now = snap(w, p), was = s.snap;
    s.snap = now;
    if (!was) return; // the first look: nothing to compare yet
    const name = id => P.name(w.people[id]);
    if (now.partner !== null && now.partner !== was.partner) Pl.moment(w, 'together', { other: name(now.partner) });
    if (now.married !== null && now.married !== was.married) Pl.moment(w, 'married', { other: name(now.married) });
    if (now.kids > was.kids) { const c = w.people[p.children[p.children.length - 1]]; Pl.moment(w, 'child', { child: c.first }); }
    if (now.grand > was.grand) Pl.moment(w, 'grandchild', {});
    for (const q of now.quals) if (!was.quals.includes(q)) { const c = C.COURSE_BY_ID[q]; Pl.moment(w, 'graduated', { qual: c ? c.name : q }); }
    if (now.job && now.job !== was.job) Pl.moment(w, was.worked ? 'newJob' : 'firstJob', { job: p.job.title });
    else if (now.job && now.level > was.level) Pl.moment(w, 'promoted', { job: LES.Labour.title(p.job) });
    if (now.retired && !was.retired) Pl.moment(w, 'retired', { age: now.age });
    if (now.biz >= 0 && now.biz !== was.biz && w.biz[now.biz]) Pl.moment(w, 'business', { biz: w.biz[now.biz].name });
    if (now.elected && !was.elected) Pl.moment(w, 'elected', { title: LES.Gov ? LES.Gov.title(w) : '' });
    for (const id of was.alive) if (!now.alive.includes(id) && !w.people[id].alive) Pl.moment(w, 'lost', { other: name(Number(id)) });
    if (now.home > was.home) Pl.moment(w, 'home', { home: C.TIERS.housing[now.home].name });
    if (now.age > was.age) {
      if (now.age === 7) Pl.moment(w, 'school', {});
      else if (now.age === 18) Pl.moment(w, 'schoolDone', {});
      const y = s.yearStart || { nw: was.nw, day: w.day - 365 };
      Pl.moment(w, 'birthday', { age: now.age, change: U.fmtMoney(p.nw - y.nw), up: p.nw >= y.nw ? 1 : 0, events: s.journal.filter(e => e.day > y.day && (e.kind === 'event' || e.kind === 'moment')).length });
      s.yearStart = { nw: p.nw, day: w.day };
    }
  });

  // ---- 4. A life goal you choose; how they feel ----
  Pl.goals = (w, p) => { const G = LES.Goals; return G ? G.IDS.filter(id => C.expOn(w, G.DEFS[id]) && (!G.DEFS[id].eligible || G.DEFS[id].eligible(w, p))) : []; };
  Pl.HANDLERS.SET_GOAL = {
    hours: 1, cooldown: 180, minAge: 16, key: () => 'goal',
    check(w, p, a) { return !Pl.goals(w, p).includes(a.goal) ? 'not_possible' : p.goal && p.goal.id === a.goal ? 'same' : null; },
    params(w, p, a) { const d = LES.Goals && LES.Goals.DEFS[a.goal]; return { goal: d ? `${d.icon} ${d.name}` : '' }; },
    run(w, p, a) {
      const G = LES.Goals, d = G.DEFS[a.goal];
      p.goal = Object.assign({ id: a.goal, since: w.day, progress: 0 }, d.init(w, p, Pl.rng(w)));
      P.log(w, p, `New life goal: ${d.icon} ${G.text(p.goal)} (their own choice)`, 'goal', 0);
      st(w).played = true;
      return { code: 'ok', params: { goal: `${d.icon} ${d.name}`, text: G.text(p.goal) } };
    },
  };
  // A line about how they feel, from their real state (and what just happened).
  Pl.mood = function (w, p) {
    const s = st(w), last = (s.moments || []).filter(m => m.day > w.day - 45).pop();
    if (last && ['married', 'child', 'grandchild', 'graduated', 'firstJob', 'together', 'business', 'elected', 'jackpot'].includes(last.kind)) return { key: `mood.after.${last.kind}`, params: last.params };
    if (last && last.kind === 'lost') return { key: 'mood.grief', params: last.params };
    if (p.health < 45) return { key: 'mood.unwell' };
    if (p.stress > 75) return { key: 'mood.stressed' };
    if (P.isAdult(w, p) && p.cash < p.mcost) return { key: 'mood.money' };
    if (P.isAdult(w, p) && p.partnerId === null && p.happy < 50 && P.age(w, p) >= 25) return { key: 'mood.lonely' };
    if (p.happy > 75) return { key: 'mood.good' };
    if (p.happy < 35) return { key: 'mood.low' };
    return { key: 'mood.ok' };
  };
})(globalThis.LES = globalThis.LES || {});
