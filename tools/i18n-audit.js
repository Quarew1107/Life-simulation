// Data audit for translations (run by tools/i18n-check.py in headless Edge on tests.html; developer tool).
// Walks the four country packs, the council roles, the official-statistics targets and the life goals for
// names and descriptions the game shows, and lists those with no translation in window.AUDIT.lang. Company
// names, internal ids (lower-case words) and plain amounts are left out (the same rules as the test
// "Every data name shown in the four countries ... has Chinese" in i18nSentenceTests).
await (async () => {
  const lang = (window.AUDIT || {}).lang || 'zh-Hans', I = LES.I18n;
  await new Promise(r => I.set(lang, r));
  if (I.lang() !== lang) return `Unknown language ${lang}`;
  const KEYS = /^(name|title|label|text|short|desc|help|fx|note|tip|why|reason|role|full|long|unit|adj|plural|what|line|headline|caption|hint|blurb|item|act|noun|src|does|en|num|den|obs)$/;
  const SKIP = /^(first|firstNames|surnames|last|given|family|streets|towns|townNames|parts|prefix|suffix|names|bizNames|gangNames|male|female|m|f|stocks|ipoPool|glcStocks|money|CLANS|place)$/;
  const gaps = new Map();
  const add = (s, path) => {
    if (typeof s !== 'string' || !/[A-Za-z]{2}/.test(s) || /^[a-z0-9]+$/.test(s) || /^[A-Z]{2,5}$/.test(s) || /^(RM|\$|£|¥)?[\d,.]+$/.test(s)) return;
    if (I.g(s) === s && !gaps.has(s)) gaps.set(s, path);
  };
  const walk = (o, path, d, inOpts) => {
    if (!o || d > 9 || typeof o === 'function') return;
    if (Array.isArray(o)) { o.forEach((v, i) => (inOpts && i === 0 && typeof v === 'string' ? null : walk(v, `${path}[${i}]`, d + 1, inOpts))); return; }
    if (typeof o !== 'object') { if (inOpts) add(o, path); return; }
    for (const k of Object.keys(o)) {
      if (SKIP.test(k)) continue;
      const v = o[k];
      if (typeof v === 'string') { if (KEYS.test(k) || /^(quals|options)$/.test(path.split('.').pop())) add(v, `${path}.${k}`); } else walk(v, `${path}.${k}`, d + 1, k === 'options' || inOpts);
    }
  };
  for (const c of ['my', 'uk', 'us', 'cn']) { LES.Countries.ensure({ country: c }); walk(LES.Countries.get(c), c, 0, false); walk(LES.Council.ROLES, `${c}.roles`, 0, false); walk(LES.Calibration.TARGETS, `${c}.statistics`, 0, false); }
  LES.Countries.ensure(LES.DEFAULTS);
  walk(LES.SETTINGS_META, 'settings', 0, false);
  for (const k of ['KIND_INFO', 'KIND_NAMES']) for (const [kind, s] of Object.entries(LES[k] || {})) add(s, `${k}.${kind}`);
  for (const id of LES.Goals.IDS) add(LES.Goals.DEFS[id].name, `goals.${id}`);
  await new Promise(r => I.set('en', r));
  return gaps.size ? [...gaps].map(([s, p]) => `${p}\t${s}`).join('\n') : `No gaps: every data name has a ${lang} version.`;
})()
