// Play a Life (Playable Life Mode): the user takes over one real resident of the town.
// PL-02: choosing that resident. With the mode off (cfg.play absent or 'off') nothing here runs and no world
// gets a `player` field, so other worlds, saves and fingerprints are unchanged.
// Choosing never uses the world's random streams (its own stream: seed|play), so a played town is the same
// town as the unplayed one until the player's first decision (PL-03 onwards marks the world as played).
//
// cfg.play: 'off' | 'random' (a random resident, default when on) | 'cast' (cfg.playCast = a My Cast spec id,
// one of the founders); cfg.playStage: 'any' | baby | child | teen | adult | senior (for 'random').
// w.player = { id, how, since, chain: [{ id, day, how }], pending: [], nextId, journal: [] }
(function (LES) {
  'use strict';
  const P = LES.P;
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
  Pl.person = w => (w && w.player ? w.people[w.player.id] : null);

  function eligible(p, stage, w) { return p.alive && !p.away && !p.inst && (stage === 'any' || !stage || Pl.stageOf(Math.floor(P.age(w, p))) === stage); }

  // Pick the resident when a world (or region) is created. Returns { w, p, note } or { error }.
  Pl.begin = function (x) {
    const towns = x.towns || [x], cfg = (x.base || x.cfg);
    if (!Pl.on(cfg)) return null;
    let w = towns[0], p = null, note = '';
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
    w.player = { id: p.id, how, since: w.day, chain: [{ id: p.id, day: w.day, how }], pending: [], nextId: 1, journal: [] };
    return { w, p, note };
  };

  // What the badge and panels show about the controlled person.
  Pl.summary = function (w) {
    const p = Pl.person(w);
    if (!p) return null;
    const age = Math.floor(P.age(w, p));
    return { id: p.id, name: P.name(p), age, stage: Pl.stageOf(age), alive: p.alive, away: !!p.away };
  };
})(globalThis.LES = globalThis.LES || {});
