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
  K.scaledCache = {};
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
    const sp = K.scaledCache[code] || (K.scaledCache[code] = K.scaled(p)); // money in engine units (see Money scale)
    K.active = code; K.pack = sp;
    for (const a of K.appliers) {
      try { a.fn(sp); } catch (e) { throw new Error(`Country pack ${code}: ${a.name}: ${e.message}`); }
    }
    return sp;
  };
  K.of = cfg => (cfg && cfg.country) || K.DEFAULT;
  // ---- Money scale ----
  // The engine has fixed amounts sized for Malaysian ringgit (a clinic visit, festival spending, the
  // 'elite' line...). A pack whose money is bigger (money.scale: US dollars ~1.75) writes its figures in
  // real money; while it is active the engine works in ringgit-sized units: these paths are divided by
  // the scale when the pack is switched on, and money is multiplied back for display (U.setCurrency).
  K.MONEY_PATHS = [
    'content.jobs.*.salary', 'content.govJobs.*.salary', 'content.courses.*.fee', 'content.gigs.*.pay', 'content.trainings.*.cost',
    'content.tiers.*.*.cost', 'content.childCost', 'content.childCostPerHousing', 'content.simpleTaxBands.*.0',
    'content.biz.*.capital|scale0|cap|fixed|fee', 'content.venues.*.cost', 'content.stocks.*.price0', 'content.glcStocks.*.price0',
    'tax.incomeBands.*.0', 'tax.personalRelief', 'tax.retirementRelief.cap', 'tax.childRelief', 'tax.rebate.amount|upTo',
    'tax.companyBands.*.0', 'tax.largeCompanyRevenue', 'tax.dividend.above', 'tax.estateAllowance', 'tax.allowanceTaper.from',
    'tax.ni.employee.from|to', 'tax.ni.employer.from', 'tax.councilTax.byTier.*', 'tax.stateBands.*.0',
    'tax.credits.eitc.*.max|outFrom', 'tax.credits.marriedExtra', 'tax.credits.ctc.amount|refundable|phaseFrom',
    'gov.leaderPay.min|max', 'gov.servicePay.*', 'gov.trainCost',
    'society.bottom40Max|top20Min|hardship|nisab', 'events.flood.relief', 'events.tornado.damage.*',
    'calibration.medWage.target|band', 'calibration.revenue.target|band',
    'welfare.jobLoss.cap|flat', 'welfare.uc.child|workAllowance', 'welfare.uc.capital.lower|upper|per250',
    'welfare.childBenefit.first|other|taperFrom|taperTo', 'welfare.statePension.weekly', 'welfare.pensionCredit.weekly',
    'welfare.snap.max|perPerson|assets|stdDeduction', 'welfare.socialSecurity.bends.*', 'welfare.socialSecurity.cap|max|typical', 'welfare.tanf.amount',
    'education.loans.threshold', 'education.pell.max|incomeLimit',
    'health.fpl.base|perPerson', 'health.plans.*.premium|familyPremium|deductible|oopMax', 'services.charges.minor',
  ];
  const clone = o => (Array.isArray(o) ? o.map(clone) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, clone(v)])) : o);
  function scaleAt(o, parts, f) {
    if (!o || typeof o !== 'object') return;
    const [head, ...rest] = parts, keys = head === '*' ? Object.keys(o) : head.split('|');
    for (const k of keys) {
      if (!(k in o)) continue;
      if (rest.length) scaleAt(o[k], rest, f);
      else if (typeof o[k] === 'number') o[k] = f(o[k]);
    }
  }
  K.scaled = function (pack) {
    const k = pack.money.scale || 1;
    if (k === 1) return pack;
    const c = clone(pack);
    for (const path of K.MONEY_PATHS) scaleAt(c, path.split('.'), v => v / k);
    return c;
  };
  K.scale = () => (K.pack && K.pack.money.scale) || 1;

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
      .replace(/\{goal\}/g, () => `${p.money.symbol}${Math.round(((p.defaults && p.defaults.goalRM) || (LES.DEFAULTS ? LES.DEFAULTS.goalRM : 1e8)) / 1e6)} million`)
      .replace(/\{k:(\d+)\}/g, (m, n) => `${p.money.symbol}${Math.round(Number(n) * (p.money.scale || 1))}k`); // engine amounts in thousands, in this money
  };
  // Money sign for the formatters (core/util.js).
  K.on('money', pack => LES.U.setCurrency(pack.money.symbol, pack.money.scale || 1));
  // The festival calendar (core/util.js loads before this registry).
  K.require('calendar.festivals');
  K.on('calendar', pack => LES.Calendar.setup(pack.calendar));
})(globalThis.LES = globalThis.LES || {});
