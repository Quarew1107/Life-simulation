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
    stopOnWinner: 'no',
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
    { key: 'seed', label: 'World seed', type: 'text', help: 'Same seed + same settings = the exact same world history.' },
    { key: 'founders', label: 'Founding population', type: 'int', min: 20, max: 500, help: '100 strangers by default.' },
    { key: 'wealthDist', label: 'Starting wealth', type: 'select', options: [['equal', 'Equal (RM10k each)'], ['moderate', 'Moderate inequality'], ['unequal', 'High inequality (some born rich)']] },
    { key: 'economy', label: 'Economy', type: 'select', options: [['stable', 'Stable'], ['normal', 'Normal cycles'], ['volatile', 'Volatile (frequent recessions)']] },
    { key: 'education', label: 'University fees', type: 'select', options: [['free', 'Free'], ['subsidised', 'Subsidised'], ['expensive', 'Expensive (x2.5)']] },
    { key: 'safetyNet', label: 'Social safety net', type: 'select', options: [['off', 'Off - original harsh rules'], ['on', 'On - welfare food & child guardians']] },
    { key: 'genetics', label: 'Child attributes', type: 'select', options: [['evolution', 'Evolution (potential + mutation)'], ['original', 'Original (average of parents, rounded down)']] },
    { key: 'strategyMode', label: 'Life strategies', type: 'select', options: [['adaptive', 'Adaptive (can change after setbacks)'], ['fixed', 'Fixed for life']] },
    { key: 'fertility', label: 'Birth rate', type: 'select', options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']] },
    { key: 'horizonYears', label: 'Simulation length (years)', type: 'int', min: 5, max: 300 },
    { key: 'goalRM', label: 'Wealth goal (RM)', type: 'int', min: 10000, max: 1e12 },
    { key: 'stopOnWinner', label: 'Pause when goal is reached', type: 'select', options: [['no', 'No, keep going'], ['yes', 'Yes']] },
  ];

  LES.derive = function (cfg) {
    return {
      eduMult: { free: 0, subsidised: 1, expensive: 2.5 }[cfg.education],
      fertMult: { low: 0.6, normal: 1, high: 1.6 }[cfg.fertility],
      goal: Math.round(cfg.goalRM * 100),
      horizonDays: cfg.horizonYears * 365,
      welfare: cfg.safetyNet === 'on',
    };
  };

  // Returns {blockers:[], warnings:[]} - never mutates cfg.
  LES.validateConfig = function (cfg) {
    const blockers = [], warnings = [];
    const isNum = x => typeof x === 'number' && Number.isFinite(x);
    for (const m of LES.SETTINGS_META) {
      const v = cfg[m.key];
      if (m.type === 'int') {
        if (!isNum(v) || Math.floor(v) !== v) blockers.push(`${m.label}: must be a whole number.`);
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

    if (!blockers.length) {
      if (cfg.goalRM > 1e9) warnings.push('A goal above RM1 billion will very likely never be reached.');
      if (cfg.founders > 300) warnings.push('Large populations can grow past 1,000 people and slow down the visual mode.');
      if (cfg.fertility === 'high' && cfg.horizonYears > 150) warnings.push('High birth rate over a long horizon may produce a very large population.');
      if (cfg.safetyNet === 'off') warnings.push('Harsh rules: abandoned children and people who cannot afford food can die.');
      if (cfg.horizonYears > 200) warnings.push('Very long runs use more memory for life histories.');
    }
    return { blockers, warnings };
  };
})(globalThis.LES = globalThis.LES || {});
