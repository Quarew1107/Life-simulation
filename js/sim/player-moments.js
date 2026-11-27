// Play a Life: what each life moment's choice does (the redesign of Nov 2026: Idea/Event redesign, imported by
// tools/events-import.py into player-moments-data.js and the -moments language files).
// Every choice now has visible effects on top of its request (the request itself is unchanged: the same person
// or institution decides):
// - mood: happiness, stress, energy (a few points, shown as they really changed after limits);
// - grow: a small step in one ability's potential, children and teens only (the same step and life cap as clubs);
// - trait: a point towards a character trait (kind, brave, studious, sociable, careful, ambitious); 2, 5 and 10
//   points show as levels on the profile. Traits describe the character; they do not change anyone's odds;
// - bond: closeness (0-100) with the person the moment names; rep: how the town sees you (0-100, from 50);
// - mem: a memory a later moment can come back to (the 40 callback moments, 20% when their situation arises);
// - time: hours spent (1 energy an hour); cost: real spending as a share of the typical monthly wage, only if
//   the money is there;
// - their: another named person's happiness or stress; susp: the partner's suspicion of an affair (0-100; it also
//   rises 8 a month by itself, and the chance of being found out each month is suspicion / 400; at 100 they find out).
// The 70 new moments (Nov 2026; Pl.NEW_MOMENTS) borrow an existing moment's situation and names, or one of the
// affair situations below (mature stories only), and happen once in a life.
// The journal line shows the result and what changed. All of it belongs to this life: a successor starts afresh.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  const EXP_MAX = 0.3; // as clubs and childhood experiences (player-catalog.js)
  Pl.TRAITS = ['kind', 'brave', 'studious', 'sociable', 'careful', 'ambitious'];
  Pl.traitLevel = n => (n >= 10 ? 3 : n >= 5 ? 2 : n >= 2 ? 1 : 0);

  // Callback moments: the situation (and names) of an existing moment, plus the memory of an earlier choice.
  for (const cb of Pl.CALLBACKS || []) {
    const t = Pl.eventById(cb.from);
    if (!t || Pl.eventById(cb.id)) continue;
    const cond = `mem:${cb.id}`;
    Pl.CONDITIONS[cond] = (w, p) => !!(st(w).memories && st(w).memories[cb.mem]) && (!Pl.CONDITIONS[t.when] || Pl.CONDITIONS[t.when](w, p));
    Pl.EVENTS.push({ id: cb.id, stages: t.stages, minAge: cb.minAge, maxAge: cb.maxAge, when: cond, chance: 0.2, cooldown: 99999, expires: t.expires || 15, imp: 1, params: t.params, mature: t.mature, callback: cb.mem,
      choices: cb.fx.map((f, i) => ({ id: 'abcd'[i], story: true })) });
  }
  // The affair situations (mature stories only) and the names they offer.
  const partnerOf = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return q && q.alive && !q.away && !q.inst ? q : null; };
  const aff = w => st(w).affair;
  Object.assign(Pl.CONDITIONS, {
    affairOn: (w, p) => !!st(w).mature && !!aff(w) && !!partnerOf(w, p) && !!w.people[aff(w).pid] && w.people[aff(w).pid].alive,
    affairLong: (w, p) => Pl.CONDITIONS.affairOn(w, p) && w.day - aff(w).since >= 180,
    affairSuspect: (w, p) => Pl.CONDITIONS.affairOn(w, p) && (aff(w).susp || 0) >= 40,
    affairFound: (w, p) => !!st(w).mature && !!st(w).affairFound && st(w).affairFound.day > w.day - 30,
    affairOver: (w, p) => !!st(w).mature && !!st(w).affairOver && st(w).affairOver.day > w.day - 365,
  });
  Object.assign(Pl.PARAMS, {
    affair: (w, p) => { const a = aff(w) || st(w).affairFound || st(w).affairOver || {}, q = a.pid >= 0 ? w.people[a.pid] : null, pt = partnerOf(w, p); return { lover: q ? P.name(q) : '', partner: pt ? P.name(pt) : '', pid: q ? q.id : -1 }; },
    affairChance: (w, p) => { const pt = partnerOf(w, p); return Object.assign({}, Pl.PARAMS.someone ? Pl.PARAMS.someone(w, p) : {}, { partner: pt ? P.name(pt) : '' }); },
  });
  Pl.TARGETS.endAffair = w => (st(w).affair ? {} : null);
  Pl.TARGETS.confess = w => (st(w).affair ? {} : null);
  // Confess the affair: the partner decides whether to stay (player-family.js, Player.affairComesOut).
  Pl.HANDLERS.CONFESS = {
    hours: 2, cooldown: 0, adult: true, key: () => 'confess',
    check(w, p) { return !st(w).mature ? 'mature_off' : !st(w).affair ? 'no_affair' : !partnerOf(w, p) ? 'no_partner' : null; },
    params(w, p) { const pt = partnerOf(w, p); return { other: pt ? P.name(pt) : '' }; },
    run(w, p) { const pt = partnerOf(w, p), name = P.name(pt); st(w).played = true; return { code: Pl.affairComesOut(w, p, 'confess') ? 'left' : 'stayed', params: { other: name } }; },
  };
  // The new moments: an existing moment's situation (or an affair situation), once in a life.
  for (const n of Pl.NEW_MOMENTS || []) {
    if (Pl.eventById(n.id)) continue;
    const t = n.from ? Pl.eventById(n.from) : null, base = t ? t.when : n.when, cond = n.needs ? `new:${n.id}` : base;
    if (n.needs) Pl.CONDITIONS[cond] = (w, p) => !!(st(w).memories && st(w).memories[n.needs]) && (!Pl.CONDITIONS[base] || Pl.CONDITIONS[base](w, p));
    Pl.EVENTS.push({ id: n.id, stages: [n.stage], minAge: n.minAge, maxAge: n.maxAge, when: cond, chance: t ? Math.min(0.3, t.chance) : 0.3, cooldown: 99999, expires: t ? t.expires : 20,
      imp: n.when === 'affairFound' ? 2 : 1, params: t ? t.params : n.params, mature: n.mature || (t && t.mature), fresh: true, callback: n.needs || undefined,
      choices: n.fx.map((f, i) => (f.req ? { id: 'abcd'[i], cmd: f.req, target: n.targets[i] } : { id: 'abcd'[i], story: true })) });
  }
  Pl.effectsOf = (evId, chId) => {
    const nm = (Pl.NEW_MOMENTS || []).find(c => c.id === evId);
    if (nm) return nm.fx['abcd'.indexOf(chId)] || null;
    const cb = (Pl.CALLBACKS || []).find(c => c.id === evId);
    if (cb) return cb.fx['abcd'.indexOf(chId)] || null;
    const e = Pl.eventById(evId), fx = Pl.MOMENT_FX && Pl.MOMENT_FX[evId];
    if (!e || !fx) return null;
    return fx[e.choices.findIndex(c => c.id === chId)] || null;
  };

  // The person a moment names ({other}, {carer}, {sibling}...), if they are still here.
  function named(w, p, name, params) {
    if ((name === 'other' || name === 'lover') && params.pid >= 0) return w.people[params.pid];
    if (name === 'carer') return Pl.carerOf(w, p);
    if (name === 'partner' && p.partnerId !== null) return w.people[p.partnerId];
    const v = params[name];
    if (!v || typeof v !== 'string') return null;
    const near = p.parents.concat(p.children, p.siblings || []).map(id => w.people[id]).filter(Boolean);
    return near.find(q => P.name(q) === v || q.first === v) || w.living.find(q => q !== p && (P.name(q) === v || q.first === v)) || null;
  }

  // Apply a choice's effects; returns what really changed, for the journal ([code, value, extra]).
  Pl.applyEffects = function (w, p, e, params) {
    const s = st(w), out = [];
    if (!e || !p || !p.alive) return out;
    params = params || {};
    const mood = (k, v, code) => { if (!v) return; const was = p[k]; p[k] = U.clamp(p[k] + v, 0, 100); const d = Math.round(p[k] - was); if (d) out.push([code, d]); };
    mood('happy', e.happy, 'happy'); mood('stress', e.stress, 'stress'); mood('energy', e.energy, 'energy');
    if (e.time) { const was = p.energy; p.energy = Math.max(0, p.energy - e.time); if (was !== p.energy) out.push(['time', e.time]); }
    if (e.cost && P.isAdult(w, p)) {
      const amt = Math.round(e.cost * Pl.typicalPay(w));
      if (amt > 0 && p.cash - amt > p.mcost && w.ledger.spend(p, 'cash', 'MERCHANT', amt)) out.push(['cost', U.fmtMoney(amt)]);
    }
    if (e.grow && !P.isAdult(w, p)) {
      const a = C[e.grow], b = s.expBoost = s.expBoost || [0, 0, 0, 0, 0, 0];
      const nb = U.clamp(b[a] + 0.008, -EXP_MAX, EXP_MAX), real = nb - b[a];
      if (real > 0) { b[a] = nb; p.pot[a] = U.clamp(p.pot[a] + real, 0, 10); out.push(['grow', e.grow]); }
    }
    for (const t of e.trait || []) { const tr = s.traits = s.traits || {}; tr[t] = (tr[t] || 0) + 1; out.push(['trait', t, Pl.traitLevel(tr[t]) > Pl.traitLevel(tr[t] - 1) ? 'up' : '']); }
    for (const [name, v] of e.bond || []) {
      const q = named(w, p, name, params);
      if (!q || !q.alive || q === p) continue;
      if (q.id === p.partnerId && Pl.coupleStart) Pl.coupleStart(w, p); // a partner starts at 60 (player-couple.js)
      const b = s.bonds = s.bonds || {}, was = b[q.id] === undefined ? 30 : b[q.id];
      b[q.id] = U.clamp(was + v, 0, 100);
      out.push(['bond', P.name(q), b[q.id] - was]);
    }
    for (const [name, k, v] of e.their || []) {
      const q = named(w, p, name, params);
      if (!q || !q.alive || q === p) continue;
      const was = q[k]; q[k] = U.clamp(q[k] + v, 0, 100); const d = Math.round(q[k] - was);
      if (d) out.push(['their', P.name(q), d, k]);
    }
    if (e.susp && s.affair) {
      const was = s.affair.susp || 0; s.affair.susp = U.clamp(was + e.susp, 0, 100);
      if (s.affair.susp !== was) out.push(['susp', s.affair.susp - was]);
      if (s.affair.susp >= 100 && Pl.affairComesOut) Pl.affairComesOut(w, p, 'found');
    }
    if (e.rep) { const was = s.rep === undefined ? 50 : s.rep; s.rep = U.clamp(was + e.rep, 0, 100); if (s.rep !== was) out.push(['rep', s.rep - was]); }
    if (e.mem) (s.memories = s.memories || {})[e.mem] = w.day;
    return out;
  };

  // Plan part 3 (Nov 2026): traits and standing matter a little. Per trait level (1-3), a request's chance moves by
  // these amounts (upsides and downsides), studying hard teaches more or less, and two traits change the monthly
  // stress. Standing in town (rep, 50 = neutral) adds up to +-4% to asks others answer (a date, a friend, a raise)
  // and counts in elections (government.js). Only the played character; nobody else's odds change.
  Pl.TRAIT_FX = {
    kind: { MAKE_FRIEND: 0.03, COUNSEL: 0.03, ASK_CLINIC: 0.02, ASK_RAISE: -0.02 },
    brave: { ASK_RAISE: 0.03, ASK_DATE: 0.03, PROPOSE: 0.02, COUNSEL: -0.02 },
    sociable: { MAKE_FRIEND: 0.03, ASK_DATE: 0.02, ASK_PARTNER: 0.03, learn: -0.1 },
    studious: { ASK_CLUB: 0.03, learn: 0.15, MAKE_FRIEND: -0.02, ASK_DATE: -0.02 },
    careful: { ASK_ALLOWANCE: 0.03, MOVE_HOME: 0.03, stress: -0.5, ASK_DATE: -0.02, ASK_RAISE: -0.02 },
    ambitious: { ASK_RAISE: 0.04, ASK_CLUB: 0.02, stress: 0.5 },
  };
  const REP_ASKS = new Set(['ASK_DATE', 'ASK_PARTNER', 'MAKE_FRIEND', 'ASK_RAISE', 'PROPOSE']);
  const levels = w => { const s = st(w), tr = (s && s.traits) || {}; return Pl.TRAITS.map(t => [t, Pl.traitLevel(tr[t] || 0)]).filter(x => x[1] > 0); };
  // How much the character's traits and standing move the chance of a request (a share, e.g. +0.06).
  Pl.traitOdds = function (w, p, kind) {
    const s = st(w);
    if (!s || !p || s.id !== p.id) return 0;
    let d = 0;
    for (const [t, lv] of levels(w)) d += (Pl.TRAIT_FX[t][kind] || 0) * lv;
    if (REP_ASKS.has(kind) && s.rep !== undefined) d += 0.04 * (s.rep - 50) / 50;
    return d;
  };
  Pl.traitLearn = w => levels(w).reduce((m, [t, lv]) => m * (1 + (Pl.TRAIT_FX[t].learn || 0) * lv), 1);
  Pl.MONTHLY.push(function (w, p) { // calm or driven: careful people worry a little less, ambitious ones push themselves
    if (!p || !p.alive) return;
    let d = 0; for (const [t, lv] of levels(w)) d += (Pl.TRAIT_FX[t].stress || 0) * lv;
    if (d) p.stress = U.clamp(p.stress + d, 0, 100);
  });
  // What a trait does, for the profile (key + params).
  Pl.traitHelp = t => ({ key: `traitfx.${t}` });

  // The journal's words for what changed: { key: 'fx.listN', params: { a: { key: 'fx.<code>', ... } } }.
  const sign = v => (v > 0 ? `+${v}` : `${v}`);
  Pl.fxText = function (list) {
    const items = list.slice(0, 8).map(([c, v, x, k]) => {
      if (c === 'happy' || c === 'stress' || c === 'energy' || c === 'rep' || c === 'susp') return { key: `fx.${c}`, params: { n: sign(v) } };
      if (c === 'their') return { key: `fx.their.${k}`, params: { name: v, n: sign(x) } };
      if (c === 'grow') return { key: 'fx.grow', params: { ability: { key: `fx.ab.${v}` } } };
      if (c === 'trait') return { key: x === 'up' ? 'fx.traitUp' : 'fx.trait', params: { trait: { key: `trait.${v}` } } };
      if (c === 'bond') return { key: 'fx.bond', params: { name: v, n: sign(x) } };
      if (c === 'time') return { key: 'fx.time', params: { count: v } };
      return { key: 'fx.cost', params: { amt: v } };
    });
    if (!items.length) return { key: 'fx.list0' };
    const params = {}; items.forEach((it, i) => { params['abcdefgh'[i]] = it; });
    return { key: `fx.list${items.length}`, params };
  };

  // The character card: traits with levels, standing in town and the closest people.
  Pl.character = function (w, p) {
    const s = st(w), tr = s.traits || {};
    const traits = Pl.TRAITS.filter(t => Pl.traitLevel(tr[t] || 0) > 0).sort((a, b) => (tr[b] - tr[a]) || a.localeCompare(b)).map(t => ({ t, level: Pl.traitLevel(tr[t]), pts: tr[t] }));
    const bonds = Object.entries(s.bonds || {}).map(([id, v]) => [w.people[id], v]).filter(([q]) => q && q.alive).sort((a, b) => (b[1] - a[1]) || (a[0].id - b[0].id)).slice(0, 3);
    return { traits, rep: s.rep === undefined ? 50 : s.rep, bonds, memories: Object.keys(s.memories || {}).length, susp: s.mature && s.affair ? Math.round(s.affair.susp || 0) : null };
  };
})(globalThis.LES = globalThis.LES || {});
