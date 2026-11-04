// World configuration: defaults, the "Normal Settings" shown on the setup screen,
// and validation (Blockers stop the world from starting, Warnings need confirmation).
(function (LES) {
  'use strict';

  LES.DEFAULTS = {
    // Normal settings (defaults = the Malaysia preset; see LES.PRESETS)
    preset: 'malaysia',       // malaysia | classic | custom (setup-screen shortcut, recorded in reports)
    seed: 'rezeki-1',
    founders: 100,
    startAgeMin: 18,
    startAgeMax: 35,
    wealthDist: 'moderate',   // equal | moderate | unequal
    economy: 'normal',        // stable | normal | volatile
    education: 'subsidised',  // free | subsidised | expensive
    safetyNet: 'on',          // on = welfare/guardians (Malaysia has JKM welfare), off = Original harsh rules
    genetics: 'evolution',    // original (floor of parents' average) | evolution
    strategyMode: 'adaptive', // adaptive | fixed
    fertility: 'malaysia',    // malaysia | low | normal | high
    horizonYears: 120,
    goalRM: 100000000,
    goalMode: 'real',         // real (Year-1 money) | nominal
    mapSize: 'auto',          // auto | kampung | pekan | bandar | bandaraya | metropolis
    layout: 'varied',         // varied (seeded avenues, river, superblocks) | grid (original equal blocks)
    society: 'on',            // social class + religion systems (off = original engine)
    ethnicMix: 'malaysia',    // malaysia (DOSM 2025 shares, 5 groups) | classic (original 3 groups)
    interfaith: 'malaysia',   // malaysia (a non-Muslim converts to marry a Muslim) | free
    crime: 'lively',          // lively (Malaysian rates x10) | realistic (x1) | lawless (x30) | off
    drugPolicy: 'malaysia',   // malaysia (rehab first, prison for repeat) | punitive | treatment | decriminalised
    police: 'normal',         // weak | normal | strong (arrest chances; with a government the police budget decides)
    government: 'on',         // town treasury, laws, elections (off = original engine)
    leaderTitle: 'president', // president | mayor | datuk
    termYears: 5,             // years between elections (Malaysia: parliament at most 5)
    termLimit: 'none',        // none | 2 (terms)
    identityVoting: 'moderate', // none | moderate | strong: weight of shared ethnicity / religion in voting
    freezeLaws: 'no',         // yes = laws stay at their starting values (elections still happen)
    stopOnWinner: 'no',
    // Scenario (js/sim/scenarios.js) and its options
    scenario: 'none',         // none | equal | reset | eternal | eduban | pandemic | robots | lawless | island | clans
    eqKids: 'yes',            // Born Equal: children are born equal too
    resetYear: '30', resetRepeat: 'no', // Great Reset
    banYear: '0',             // Education Ban: from this year
    pandemicYear: '10', pandemicSeverity: 'covid', // Pandemic
    robotYear: '5', robotSpeed: 'normal',          // Robot Age
    inflMin: -0.5,            // % per year; Malaysia 2010s ~0.7-3.9%, 2020 -1.1%, 2022 3.3%
    inflMax: 4.5,
    migration: 'low',         // off | low | normal | high
    // Advanced
    migInMult: 1,
    migOutMult: 1,
    mortMult: 1.9,            // old-age mortality multiplier (1.9 gives Malaysia's ~75-year life expectancy)
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
    vacancyRate: 2.2,
    vacancyDaysMin: 3,
    vacancyDaysMax: 30,
    hiringWeights: [0.6, 0.25, 0.15],
    twinProb: 0.02,
    adultAge: 18,
    birthSpacingDays: 300,
    gestationDays: 270,
  };

  // Presets fill the setup form. Classic reproduces the original engine (harsher, more
  // children, longer lives); Malaysia is calibrated to DOSM figures (tools/calibration.html).
  LES.PRESETS = {
    malaysia: { name: 'Malaysia today', values: { safetyNet: 'on', fertility: 'malaysia', mortMult: 1.9, layout: 'varied', society: 'on', ethnicMix: 'malaysia', crime: 'lively', government: 'on', vacancyRate: 2.2 } },
    classic: { name: 'Classic (original rules)', values: { safetyNet: 'off', fertility: 'normal', mortMult: 1, layout: 'grid', society: 'off', ethnicMix: 'classic', crime: 'off', government: 'off', vacancyRate: 2.5 } },
  };
  LES.presetOf = function (cfg) {
    for (const k of Object.keys(LES.PRESETS)) {
      const v = LES.PRESETS[k].values;
      if (Object.keys(v).every(x => cfg[x] === v[x])) return k;
    }
    return 'custom';
  };

  // Settings shown on the setup screen. essential = on the main page ("Your town");
  // everything else sits in Advanced settings under its group. Scenario options appear
  // with their scenario.
  LES.SETTINGS_GROUPS = ['Base rules', 'Town & map', 'Goal', 'Economy & prices', 'People & families', 'Society & religion', 'Crime & justice', 'Government'];
  LES.SETTINGS_META = [
    { group: 'Scenario', key: 'scenario', label: 'Scenario', type: 'select', hidden: true, options: [['none', 'None'], ['equal', 'Born Equal'], ['reset', 'Great Reset'], ['eternal', 'Eternal Life'], ['eduban', 'Education Ban'], ['pandemic', 'Pandemic'], ['robots', 'Robot Age'], ['lawless', 'Lawless Town'], ['island', 'Isolated Island'], ['clans', 'Five Clans']] },
    { group: 'Scenario', scenario: 'equal', key: 'eqKids', label: 'Children', type: 'select', options: [['yes', 'Born equal too'], ['no', 'Inherit from their parents']] },
    { group: 'Scenario', scenario: 'reset', key: 'resetYear', label: 'Reset in year', type: 'select', options: [['10', 'Year 10'], ['20', 'Year 20'], ['30', 'Year 30'], ['50', 'Year 50']] },
    { group: 'Scenario', scenario: 'reset', key: 'resetRepeat', label: 'Repeat', type: 'select', options: [['no', 'Once'], ['yes', 'Every time that many years pass']] },
    { group: 'Scenario', scenario: 'eduban', key: 'banYear', label: 'Schools close', type: 'select', options: [['0', 'From the start'], ['10', 'In year 10'], ['20', 'In year 20']] },
    { group: 'Scenario', scenario: 'pandemic', key: 'pandemicYear', label: 'Virus arrives', type: 'select', options: [['5', 'Year 5'], ['10', 'Year 10'], ['20', 'Year 20']] },
    { group: 'Scenario', scenario: 'pandemic', key: 'pandemicSeverity', label: 'Severity', type: 'select', options: [['covid', 'Like COVID-19'], ['severe', 'Severe (3x deadlier, hits young adults too)']] },
    { group: 'Scenario', scenario: 'robots', key: 'robotYear', label: 'Automation starts', type: 'select', options: [['0', 'At once'], ['5', 'Year 5'], ['15', 'Year 15']] },
    { group: 'Scenario', scenario: 'robots', key: 'robotSpeed', label: 'Speed', type: 'select', options: [['slow', 'Slow (40 years to the peak)'], ['normal', 'Normal (25 years)'], ['fast', 'Fast (12 years)']] },

    // ---- Your town (main page) ----
    { group: 'Town & map', essential: true, key: 'founders', label: 'Founding population', type: 'int', min: 20, max: 6000, help: 'Strangers who found the town. The map size follows (100 = a small pekan).' },
    { group: 'Goal', essential: true, key: 'horizonYears', label: 'Years to simulate', type: 'int', min: 5, max: 300, help: '120 years is about four generations.' },
    { group: 'Economy & prices', essential: true, key: 'wealthDist', label: 'Starting wealth', type: 'select', options: [['equal', 'Equal (RM10k each)'], ['moderate', 'Moderate inequality'], ['unequal', 'High inequality (some born rich)']] },
    { group: 'Economy & prices', essential: true, key: 'economy', label: 'Economic cycles', type: 'select', options: [['stable', 'Stable'], ['normal', 'Normal cycles'], ['volatile', 'Volatile (frequent recessions)']] },
    { group: 'Crime & justice', essential: true, key: 'crime', label: 'Crime & vice', type: 'select', options: [['lively', 'Lively (Malaysian rates x10)'], ['realistic', 'Realistic (rare in a small town)'], ['lawless', 'Lawless (x30)'], ['off', 'Off']], help: 'Lively makes crime visible in a small town.' },
    { group: 'Town & map', essential: true, key: 'seed', label: 'World seed', type: 'text', help: 'Same seed + same settings = the same history.' },

    // ---- Advanced ----
    { group: 'Base rules', key: 'preset', label: 'Rules', type: 'select', options: [['malaysia', 'Malaysia today (calibrated to DOSM data)'], ['classic', 'Classic (original harsh rules)'], ['custom', 'Custom']], help: 'Fills the settings below. Malaysia: welfare on, ~1.6 children per woman, ~75-year life expectancy.' },
    { group: 'Town & map', key: 'mapSize', label: 'Map size', type: 'select', options: [['auto', 'Auto (suggested from population)'], ['kampung', 'Kampung - up to ~60 founders'], ['pekan', 'Pekan - 60-250 founders'], ['bandar', 'Bandar - 250-700 founders'], ['bandaraya', 'Bandaraya - 700-2,000 founders'], ['metropolis', 'Metropolis - 2,000-5,000+ founders']], help: 'Bigger maps have more homes, shops, venues, bus lines and land to grow on.' },
    { group: 'Town & map', key: 'layout', label: 'Street layout', type: 'select', options: [['varied', 'Varied (avenues, a river, superblocks)'], ['grid', 'Grid (original equal blocks)']], help: 'Varied layouts change with the seed.' },
    { group: 'Goal', key: 'goalRM', label: 'Wealth goal (RM)', type: 'int', min: 10000, max: 1e12 },
    { group: 'Goal', key: 'goalMode', label: 'Goal measured in', type: 'select', options: [['real', 'Year-1 money (adjusted for inflation)'], ['nominal', "That year's ringgit (nominal)"]], help: 'Real keeps the goal equally hard across generations.' },
    { group: 'Goal', key: 'stopOnWinner', label: 'Pause when goal is reached', type: 'select', options: [['no', 'No, keep going'], ['yes', 'Yes']] },
    { group: 'Economy & prices', key: 'inflMin', label: 'Inflation min (%/yr)', type: 'num', min: -10, max: 30, step: 0.1, help: 'Malaysia: 2020 was -1.1%.' },
    { group: 'Economy & prices', key: 'inflMax', label: 'Inflation max (%/yr)', type: 'num', min: -10, max: 30, step: 0.1, help: 'Malaysia: 2010s ranged 0.7-3.9%, ~2% average.' },
    { group: 'Economy & prices', key: 'education', label: 'University fees', type: 'select', options: [['free', 'Free'], ['subsidised', 'Subsidised'], ['expensive', 'Expensive (x2.5)']], help: 'With a government this is the starting law.' },
    { group: 'Economy & prices', key: 'marketOutsideRM', label: 'Outside stock market size (RM)', type: 'int', min: 1000000, max: 1e13, help: 'Town influence = town holdings / (town + this). Smaller = residents move prices more.' },
    { group: 'Economy & prices', key: 'marketInfluenceCap', label: 'Max town influence on prices (%)', type: 'int', min: 0, max: 100 },
    { group: 'People & families', key: 'safetyNet', label: 'Social safety net', type: 'select', options: [['off', 'Off - original harsh rules'], ['on', 'On - welfare food & child guardians']] },
    { group: 'People & families', key: 'fertility', label: 'Birth rate', type: 'select', options: [['malaysia', 'Malaysia today (~1.6 children per woman)'], ['low', 'Low'], ['normal', 'Normal (original, ~2.5)'], ['high', 'High']] },
    { group: 'People & families', key: 'mortMult', label: 'Old-age mortality multiplier', type: 'num', min: 0, max: 5, step: 0.1, help: '1 = original engine (~80-year lives), 1.9 = Malaysia (75.3 years). 0 = nobody dies of old age.' },
    { group: 'People & families', key: 'migration', label: 'Migration in/out of town', type: 'select', options: [['off', 'Off'], ['low', 'Low (default)'], ['normal', 'Normal'], ['high', 'High']], help: 'Crowding and rent push people out; jobs pull newcomers in.' },
    { group: 'People & families', key: 'migInMult', label: 'Move-in rate multiplier', type: 'num', min: 0, max: 20, step: 0.1 },
    { group: 'People & families', key: 'migOutMult', label: 'Move-out rate multiplier', type: 'num', min: 0, max: 20, step: 0.1 },
    { group: 'People & families', key: 'genetics', label: 'Child attributes', type: 'select', options: [['evolution', 'Evolution (potential + mutation)'], ['original', 'Original (average of parents, rounded down)']] },
    { group: 'People & families', key: 'strategyMode', label: 'Life strategies', type: 'select', options: [['adaptive', 'Adaptive (can change after setbacks)'], ['fixed', 'Fixed for life']] },
    { group: 'Society & religion', key: 'society', label: 'Social class & religion', type: 'select', options: [['on', 'On (B40/M40/T20, religion, festivals)'], ['off', 'Off (original engine)']], help: 'Religion works through worship, zakat, fasting and festivals - never as a success bonus.' },
    { group: 'Society & religion', key: 'ethnicMix', label: 'Population mix', type: 'select', options: [['malaysia', 'Malaysia 2025 (Malay, Chinese, other Bumiputera, Indian, others)'], ['classic', 'Classic (Malay, Chinese, Indian)']], help: 'Groups differ in names, looks, festivals and religion mix - not in ability.' },
    { group: 'Society & religion', key: 'interfaith', label: 'Interfaith marriage', type: 'select', options: [['malaysia', 'Malaysian rule (convert to marry a Muslim)'], ['free', 'Free choice']] },
    { group: 'Crime & justice', key: 'drugPolicy', label: 'Drug policy', type: 'select', options: [['malaysia', 'Malaysian mix (rehab first, prison for repeat)'], ['punitive', 'Punitive (prison)'], ['treatment', 'Treatment first (short rehab, voluntary help)'], ['decriminalised', 'Decriminalised use']], help: 'With a government this is the starting law.' },
    { group: 'Crime & justice', key: 'police', label: 'Police strength (no government)', type: 'select', options: [['normal', 'Normal'], ['strong', 'Strong (more arrests)'], ['weak', 'Weak']], help: 'Only used when there is no government; otherwise the budget pays for officers.' },
    { group: 'Government', key: 'government', label: 'Government & elections', type: 'select', options: [['on', 'On (taxes, council, laws, elections)'], ['off', 'Off (original engine)']], help: 'Taxes fund public services; an elected leader changes the laws.' },
    { group: 'Government', key: 'leaderTitle', label: 'Leader title', type: 'select', options: [['president', 'President'], ['mayor', 'Mayor'], ['datuk', 'Datuk Bandar']] },
    { group: 'Government', key: 'termYears', label: 'Years between elections', type: 'int', min: 2, max: 10 },
    { group: 'Government', key: 'termLimit', label: 'Term limit', type: 'select', options: [['none', 'None (like Malaysia)'], ['2', 'Two terms']] },
    { group: 'Government', key: 'identityVoting', label: 'Identity in voting', type: 'select', options: [['moderate', 'Moderate'], ['none', 'None'], ['strong', 'Strong']], help: 'How much voters favour candidates of their own ethnicity or religion.' },
    { group: 'Government', key: 'freezeLaws', label: 'Laws fixed at the starting values', type: 'select', options: [['no', 'No: elected leaders change them'], ['yes', 'Yes (for controlled experiments)']] },
  ];

  LES.derive = function (cfg) {
    return {
      eduMult: { free: 0, subsidised: 1, expensive: 2.5 }[cfg.education],
      fertMult: { malaysia: 0.42, low: 0.6, normal: 1, high: 1.6 }[cfg.fertility],
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
      if (cfg.founders > 1500) warnings.push('Very large populations run slower (120 years can take 10-15 minutes at MAX); people are drawn as dots when zoomed out.');
      else if (cfg.founders > 300) warnings.push('Large populations can grow past 1,000 people and slow down the visual mode.');
      if (cfg.fertility === 'high' && cfg.horizonYears > 150) warnings.push('High birth rate over a long horizon may produce a very large population.');
      if (cfg.safetyNet === 'off') warnings.push('Harsh rules: abandoned children and people who cannot afford food can die.');
      if (cfg.horizonYears > 200) warnings.push('Very long runs use more memory for life histories.');
      const msz = LES.MAP_SIZES[LES.MAP_ALIASES[cfg.mapSize] || cfg.mapSize];
      if (cfg.mapSize !== 'auto' && msz && cfg.founders > msz.maxFounders) warnings.push(`${msz.name} map is small for ${cfg.founders} founders; homes will be crowded and rents high.`);
      if (cfg.inflMax > 10) warnings.push('Inflation above 10%/yr erodes savings fast; wages only partly keep up.');
      if (cfg.goalMode === 'nominal' && cfg.inflMin + cfg.inflMax > 4) warnings.push('Nominal goal + inflation: the goal gets much easier in later generations.');
      if (cfg.migration === 'high') warnings.push('High migration changes the population a lot; founders may be outnumbered by newcomers.');
    }
    return { blockers, warnings };
  };
})(globalThis.LES = globalThis.LES || {});
