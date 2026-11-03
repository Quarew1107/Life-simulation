// Plug-in point for the optional world systems (society, crime, government, scenarios).
// A system is a plain object of hooks; the world calls only the systems its settings
// switch on, in a fixed order. With every system off the engine behaves exactly as
// before (same seed = same history), which the tests check against stored fingerprints.
//
// Hooks (all optional):
//   enabled(cfg)                    -> is the system on for these settings?
//   init(w)                         after founders are created
//   day(w)                          once a day, after everyone has acted
//   month(w) / year(w)              at month / year close, after the core systems
//   candidates(w, p, ctx, slot, add) add choices: add(goalBias, id, utility, loc, data)
//   resolve(w, p, c, ctx, slot)     carry out a choice this system added; return true if handled
//   label(id, data)                 display text of one of its choices (or undefined)
//   death(w, p, cause)              before the estate is settled
//   invariants(w, errs)             push problems found into errs
//   hash(w, parts)                  add state to the reproducibility fingerprint
//   snapshot(w, row)                add fields to this month's history row (for charts)
//   personCreated(w, p, how)        a founder, newcomer ('adult') or child ('child') was just created
//   coupleWeight(w, a, b)           multiplier on the chance that two singles who met get together
//   coupled(w, a, b)                a couple has just formed
//   breakupWeight(w, a, b)          multiplier on a couple's monthly break-up chance
//   venueBias(w, p, venueKey)       added to how much a person likes a leisure venue
//   stockOk(w, p, ticker)           false = this person will not buy that share
//   money(w)                        sen held in accounts the system owns (for the money check)
(function (LES) {
  'use strict';
  const reg = [];
  const HOOKS = ['init', 'day', 'month', 'year', 'candidates', 'resolve', 'label', 'death', 'invariants', 'hash', 'snapshot',
    'personCreated', 'coupleWeight', 'coupled', 'breakupWeight', 'venueBias', 'stockOk', 'money'];

  LES.Systems = {
    register(sys) {
      if (!sys || typeof sys.id !== 'string') throw new Error('System needs an id');
      if (reg.some(s => s.id === sys.id)) throw new Error(`System ${sys.id} registered twice`);
      reg.push(Object.assign({ order: 100 }, sys));
      reg.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
    },
    unregister(id) { const i = reg.findIndex(s => s.id === id); if (i >= 0) reg.splice(i, 1); },
    all: () => reg.slice(),
    // Systems switched on by cfg, grouped by hook for the hot paths.
    active(cfg) {
      const on = reg.filter(s => !s.enabled || s.enabled(cfg));
      const by = { ids: on.map(s => s.id) };
      for (const h of HOOKS) by[h] = on.filter(s => typeof s[h] === 'function');
      return by;
    },
  };
})(globalThis.LES = globalThis.LES || {});
