// Country packs: everything national (money, prices, wages, taxes, welfare, names, religions,
// festivals, government posts, laws, art, calibration targets) lives in one file per country
// (js/data/countries/my.js, ...). The engine keeps reading its usual tables; a module that has
// national values registers an "applier" with LES.Countries.on, which copies the active pack's
// values into those tables. Appliers update objects in place (saves refer to content tables
// by path), so switching packs keeps every reference valid.
//
// A world records its country in cfg.country. World creation, save loading and the first line of
// World.step call LES.Countries.ensure, so two worlds of different countries can run side by side.
(function (LES) {
  'use strict';
  const K = LES.Countries = { packs: {}, order: [], active: null, pack: null, appliers: [] };

  K.DEFAULT = 'my';
  K.register = function (pack) {
    K.packs[pack.code] = pack;
    if (!K.order.includes(pack.code)) K.order.push(pack.code);
    if (!K.active || K.active === pack.code) K.use(pack.code);
  };
  K.get = code => K.packs[code] || null;
  // name is for error messages; fn(pack) runs now (for the active pack) and on every switch.
  K.on = function (name, fn) {
    K.appliers.push({ name, fn });
    if (K.pack) fn(K.pack);
  };
  K.use = function (code) {
    const p = K.packs[code];
    if (!p) throw new Error(`Unknown country: ${code}`);
    K.active = code; K.pack = p;
    for (const a of K.appliers) {
      try { a.fn(p); } catch (e) { throw new Error(`Country pack ${code}: ${a.name}: ${e.message}`); }
    }
    return p;
  };
  K.of = cfg => (cfg && cfg.country) || K.DEFAULT;
  K.ensure = cfg => { const c = K.of(cfg); if (K.active !== c) K.use(c); };

  // Parts every pack must have (dotted paths). Each module adds its own with K.require.
  K.REQUIRED = ['code', 'name', 'adj', 'money.symbol'];
  K.require = (...paths) => { for (const p of paths) if (!K.REQUIRED.includes(p)) K.REQUIRED.push(p); };
  K.validate = function (pack) {
    const missing = [];
    for (const path of K.REQUIRED) {
      let o = pack;
      for (const k of path.split('.')) o = o == null ? undefined : o[k];
      if (o === undefined) missing.push(path);
    }
    return missing;
  };

  // Country words in texts: {cur} money sign, {currency} its name, {adj} 'Malaysian', {country} 'Malaysia',
  // {goal} the default wealth goal ('RM100 million').
  K.fill = text => {
    const p = K.pack;
    return text == null || !p ? text : String(text).replace(/\{cur\}/g, p.money.symbol).replace(/\{currency\}/g, p.money.name || p.money.code)
      .replace(/\{adj\}/g, p.adj).replace(/\{country\}/g, p.name)
      .replace(/\{goal\}/g, () => `${p.money.symbol}${Math.round((LES.DEFAULTS ? LES.DEFAULTS.goalRM : 1e8) / 1e6)} million`);
  };
  // Money sign for the formatters (core/util.js).
  K.on('money', pack => LES.U.setCurrency(pack.money.symbol));
  // The festival calendar (core/util.js loads before this registry).
  K.require('calendar.festivals');
  K.on('calendar', pack => LES.Calendar.setup(pack.calendar));
})(globalThis.LES = globalThis.LES || {});
