// World configuration: defaults, the "Normal Settings" shown on the setup screen,
// and validation (Blockers stop the world from starting, Warnings need confirmation).
(function (LES) {
  'use strict';

  LES.DEFAULTS = {
    // Normal settings
    seed: 'rezeki-1',
    founders: 100,
    startAgeMin: 18,
    startAgeMax: 35,
    wealthDist: 'moderate',   // equal | moderate | unequal
    economy: 'normal',        // stable | normal | volatile
    education: 'subsidised',  // free | subsidised | expensive
    safetyNet: 'off',         // off = Original harsh rules, on = welfare/guardians
    genetics: 'evolution',    // original (floor of parents' average) | evolution
    strategyMode: 'adaptive', // adaptive | fixed
    fertility: 'normal',      // low | normal | high
    horizonYears: 120,
    goalRM: 100000000,
    goalMode: 'real',         // real (Year-1 money) | nominal
    mapSize: 'auto',          // auto | small | medium | large
    stopOnWinner: 'no',
    inflMin: -0.5,            // % per year; Malaysia 2010s ~0.7-3.9%, 2020 -1.1%, 2022 3.3%
    inflMax: 4.5,
    migration: 'low',         // off | low | normal | high
    // Advanced
    migInMult: 1,
    migOutMult: 1,
    marketOutsideRM: 200000000, // size of the outside market the town trades against
    marketInfluenceCap: 80,     // max % of price movement the residents can drive
    // Advanced (FSD 15.1 provisional values)
    softmaxT: 0.6,
    successSlope: 0.9,
    xpBonus: 0.2,
    successMin: 0.02,
    successMax: 0.98,
    catBase: 0.001,
    catGap: 0.0005,
    catCap: 0.02,
    shiftsPerMonth: 20,
    vacancyRate: 2.5,
    vacancyDaysMin: 3,
    vacancyDaysMax: 30,
    hiringWeights: [0.6, 0.25, 0.15],
    twinProb: 0.02,
    adultAge: 18,
    birthSpacingDays: 300,
    gestationDays: 270,
  };

  LES.SETTINGS_META = [
    { group: 'World', key: 'seed', label: 'World seed', type: 'text', help: 'Same seed + same settings = the exact same world history.' },
    { group: 'World', key: 'founders', label: 'Founding population', type: 'int', min: 20, max: 500, help: '100 strangers by default.' },
    { group: 'World', key: 'mapSize', label: 'Map size', type: 'select', options: [['auto', 'Auto (suggested from population)'], ['small', 'Kampung - small (up to ~80 founders)'], ['medium', 'Bandar - medium (80-250 founders)'], ['large', 'Bandaraya - large (250+ founders)']], help: 'Bigger maps have more homes, shops, facilities, bus lines and land to grow on.' },
    { group: 'World', key: 'wealthDist', label: 'Starting wealth', type: 'select', options: [['equal', 'Equal (RM10k each)'], ['moderate', 'Moderate inequality'], ['unequal', 'High inequality (some born rich)']] },
    { group: 'World', key: 'horizonYears', label: 'Simulation length (years)', type: 'int', min: 5, max: 300 },
    { group: 'World', key: 'goalRM', label: 'Wealth goal (RM)', type: 'int', min: 10000, max: 1e12 },
    { group: 'World', key: 'goalMode', label: 'Goal measured in', type: 'select', options: [['real', 'Year-1 money (adjusted for inflation)'], ['nominal', "That year's ringgit (nominal)"]], help: 'Real keeps the goal equally hard across generations.' },
    { group: 'Economy', key: 'economy', label: 'Economic cycles', type: 'select', options: [['stable', 'Stable'], ['normal', 'Normal cycles'], ['volatile', 'Volatile (frequent recessions)']] },
    { group: 'Economy', key: 'inflMin', label: 'Inflation min (%/yr)', type: 'num', min: -10, max: 30, step: 0.1, help: 'Malaysia: 2020 was -1.1%.' },
    { group: 'Economy', key: 'inflMax', label: 'Inflation max (%/yr)', type: 'num', min: -10, max: 30, step: 0.1, help: 'Malaysia: 2010s ranged 0.7-3.9%, ~2% average.' },
    { group: 'Economy', key: 'education', label: 'University fees', type: 'select', options: [['free', 'Free'], ['subsidised', 'Subsidised'], ['expensive', 'Expensive (x2.5)']] },
    { group: 'Society', key: 'safetyNet', label: 'Social safety net', type: 'select', options: [['off', 'Off - original harsh rules'], ['on', 'On - welfare food & child guardians']] },
    { group: 'Society', key: 'migration', label: 'Migration in/out of town', type: 'select', options: [['off', 'Off'], ['low', 'Low (default)'], ['normal', 'Normal'], ['high', 'High']], help: 'Crowding and rent push people out; jobs pull newcomers in.' },
    { group: 'Society', key: 'genetics', label: 'Child attributes', type: 'select', options: [['evolution', 'Evolution (potential + mutation)'], ['original', 'Original (average of parents, rounded down)']] },
    { group: 'Society', key: 'strategyMode', label: 'Life strategies', type: 'select', options: [['adaptive', 'Adaptive (can change after setbacks)'], ['fixed', 'Fixed for life']] },
    { group: 'Society', key: 'fertility', label: 'Birth rate', type: 'select', options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']] },
    { group: 'Society', key: 'stopOnWinner', label: 'Pause when goal is reached', type: 'select', options: [['no', 'No, keep going'], ['yes', 'Yes']] },
    { group: 'Advanced', key: 'marketOutsideRM', label: 'Outside stock market size (RM)', type: 'int', min: 1000000, max: 1e13, help: 'Town influence = town holdings / (town + this). Smaller = residents move prices more.' },
    { group: 'Advanced', key: 'marketInfluenceCap', label: 'Max town influence on prices (%)', type: 'int', min: 0, max: 100 },
    { group: 'Advanced', key: 'migInMult', label: 'Move-in rate multiplier', type: 'num', min: 0, max: 20, step: 0.1 },
    { group: 'Advanced', key: 'migOutMult', label: 'Move-out rate multiplier', type: 'num', min: 0, max: 20, step: 0.1 },
  ];

  LES.derive = function (cfg) {
    return {
      eduMult: { free: 0, subsidised: 1, expensive: 2.5 }[cfg.education],
      fertMult: { low: 0.6, normal: 1, high: 1.6 }[cfg.fertility],
      goal: Math.round(cfg.goalRM * 100),
      horizonDays: cfg.horizonYears * 365,
      welfare: cfg.safetyNet === 'on',
      migMult: LES.C.MIGRATION_LEVELS[cfg.migration],
    };
  };

  // Returns {blockers:[], warnings:[]} - never mutates cfg.
  LES.validateConfig = function (cfg) {
    const blockers = [], warnings = [];
    const isNum = x => typeof x === 'number' && Number.isFinite(x);
    for (const m of LES.SETTINGS_META) {
      const v = cfg[m.key];
      if (m.type === 'int' || m.type === 'num') {
        if (!isNum(v) || (m.type === 'int' && Math.floor(v) !== v)) blockers.push(`${m.label}: must be a ${m.type === 'int' ? 'whole ' : ''}number.`);
        else if (v < m.min || v > m.max) blockers.push(`${m.label}: must be between ${m.min.toLocaleString()} and ${m.max.toLocaleString()}.`);
      } else if (m.type === 'select') {
        if (!m.options.some(o => o[0] === v)) blockers.push(`${m.label}: invalid choice.`);
      } else if (m.type === 'text') {
        if (typeof v !== 'string' || !v.trim()) blockers.push(`${m.label}: cannot be empty.`);
        else if (v.length > 40) blockers.push(`${m.label}: 40 characters max.`);
      }
    }
    const numeric = ['softmaxT', 'successSlope', 'xpBonus', 'successMin', 'successMax', 'catBase', 'catGap', 'catCap', 'shiftsPerMonth', 'vacancyRate', 'twinProb', 'adultAge'];
    for (const k of numeric) if (!isNum(cfg[k])) blockers.push(`${k}: must be a finite number.`);
    if (isNum(cfg.softmaxT) && (cfg.softmaxT < 0.05 || cfg.softmaxT > 3)) blockers.push('Decision randomness (softmaxT) must be 0.05-3.');
    if (cfg.successMin >= cfg.successMax) blockers.push('Minimum success chance must be below maximum.');
    if (cfg.vacancyDaysMin > cfg.vacancyDaysMax) blockers.push('Vacancy open days: min must be <= max.');
    const hw = cfg.hiringWeights;
    if (!Array.isArray(hw) || hw.length !== 3 || hw.some(x => !isNum(x) || x < 0) || Math.abs(hw[0] + hw[1] + hw[2] - 1) > 1e-6) blockers.push('Hiring weights must be 3 non-negative numbers summing to 1.');
    if (cfg.shiftsPerMonth > 28) blockers.push('Work shifts per month cannot exceed 28 (shortest month).');
    if (isNum(cfg.inflMin) && isNum(cfg.inflMax) && cfg.inflMin > cfg.inflMax) blockers.push('Inflation min must be <= inflation max.');

    if (!blockers.length) {
      if (cfg.goalRM > 1e9) warnings.push('A goal above RM1 billion will very likely never be reached.');
      if (cfg.founders > 300) warnings.push('Large populations can grow past 1,000 people and slow down the visual mode.');
      if (cfg.fertility === 'high' && cfg.horizonYears > 150) warnings.push('High birth rate over a long horizon may produce a very large population.');
      if (cfg.safetyNet === 'off') warnings.push('Harsh rules: abandoned children and people who cannot afford food can die.');
      if (cfg.horizonYears > 200) warnings.push('Very long runs use more memory for life histories.');
      if (cfg.mapSize !== 'auto' && cfg.founders > LES.MAP_SIZES[cfg.mapSize].maxFounders) warnings.push(`${LES.MAP_SIZES[cfg.mapSize].name} map is small for ${cfg.founders} founders; homes will be crowded and rents high.`);
      if (cfg.inflMax > 10) warnings.push('Inflation above 10%/yr erodes savings fast; wages only partly keep up.');
      if (cfg.goalMode === 'nominal' && cfg.inflMin + cfg.inflMax > 4) warnings.push('Nominal goal + inflation: the goal gets much easier in later generations.');
      if (cfg.migration === 'high') warnings.push('High migration changes the population a lot; founders may be outnumbered by newcomers.');
    }
    return { blockers, warnings };
  };
})(globalThis.LES = globalThis.LES || {});
