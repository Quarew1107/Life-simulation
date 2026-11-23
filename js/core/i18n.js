// Interface language (PL-01). Presentation only: the language never touches the simulation, its random
// streams, settings, saves or fingerprints. The country pack still decides laws, prices, currency and names.
//
// Keys are stable dotted ids, "<namespace>.<name>", e.g. "setup.start". Content records (Play a Life events)
// use stable canonical ids, never English sentences, and are looked up as:
//   ev.<EVENT_ID>.title   ev.<EVENT_ID>.body   ev.<EVENT_ID>.<CHOICE_ID>   ev.<EVENT_ID>.<CHOICE_ID>.result
// e.g. ev.TE-EDU-001.title, ev.TE-EDU-001.public  (I18n.ev builds these). Saved records keep { key, params },
// so a save made in Chinese reads in English and the other way round (I18n.render).
//
// Values: plain strings with {name} placeholders, or { one, other, ... } plural forms chosen by
// Intl.PluralRules with params.count. Missing in the chosen language -> English -> the key itself (never throws).
// Dictionaries are plain scripts (js/i18n/<lang>.js calling I18n.add) because file:// pages cannot fetch JSON;
// English is loaded with the page, other languages on first use.
(function (LES) {
  'use strict';
  const I = LES.I18n = {};
  I.LANGS = [['en', 'English'], ['zh-Hans', '简体中文'], ['ja', '日本語'], ['ko', '한국어'], ['es', 'Español']];
  I.DEFAULT = 'en';
  const dict = { en: {} };
  const missing = new Set();
  let lang = I.DEFAULT;

  I.add = function (code, entries) { Object.assign(dict[code] = dict[code] || {}, entries); };
  I.lang = () => lang;
  I.has = (key, code) => Object.prototype.hasOwnProperty.call(dict[code || lang] || {}, key);
  I.loaded = code => !!dict[code] && Object.keys(dict[code]).length > 0;

  // A parameter may itself be a message ({ key, params }), e.g. an event title inside "... passed".
  const val = v => (v && typeof v === 'object' && v.key ? I.t(v.key, v.params) : String(v));
  // Values that carry a data name from the game (a job, a course, a home...) are looked up in the glossary too,
  // so "Moved into {home}" reads in the language even when the engine stored the English name (PL-17).
  const DATA = new Set(['job', 'title', 'course', 'home', 'type', 'goal', 'office', 'festival', 'cls', 'level', 'strat', 'biz', 'what', 'club', 'trip', 'item', 'role', 'kind', 'place', 'reason', 'why', 'qual', 'sector', 'act', 'ret', 'k', 'name', 'map', 'size', 'fund', 'cause']);
  const fill = (s, params) => s.replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? (DATA.has(k) && typeof params[k] === 'string' ? I.g(params[k]) : val(params[k])) : m));
  function pick(v, params, code) {
    if (typeof v === 'string') return v;
    if (!v || typeof v !== 'object') return null;
    const n = params && typeof params.count === 'number' ? params.count : 1;
    let form = 'other';
    try { form = new Intl.PluralRules(code).select(n); } catch (e) { /* old browser: 'other' */ }
    return v[form] !== undefined ? v[form] : v.other !== undefined ? v.other : null;
  }

  // Translate a key. Falls back to English, then to the key (recorded once in I.missing()).
  I.t = function (key, params) {
    let s = pick((dict[lang] || {})[key], params, lang);
    if (s === null) {
      s = pick(dict.en[key], params, 'en');
      if (lang !== 'en' || s === null) missing.add(`${lang}:${key}`);
    }
    return fill(s === null ? key : s, params);
  };
  I.missing = () => [...missing];
  // Glossary (PL-17): names that come from the game's data (strategies, lifestyle levels, weather...) are
  // translated by their exact English text, so every country pack's own names work. Unknown: the English as is.
  const gloss = {}; // data names and descriptions by exact English text (js/i18n/<lang>-sentences.js)
  I.glossary = (code, map) => { Object.assign(gloss[code] = gloss[code] || {}, map); cache.clear(); };
  // One lookup for data names and sentences: the exact text (a g: key or the glossary), a rank before a job
  // title ("Lead Waiter"), then the sentence patterns, whose parts are looked up the same way (so "Senior
  // Delivery Driver" or "injured in a work accident as Electrician" inside a longer sentence also read in
  // the language). Results are cached per language; unknown text comes back as it is.
  const cache = new Map();
  const exact1 = s => (I.has(`g:${s}`) ? I.t(`g:${s}`) : gloss[lang] && Object.prototype.hasOwnProperty.call(gloss[lang], s) ? gloss[lang][s] : null);
  const exact = s => { // "terrace house" or "trading company" inside a sentence: also as the data spells it
    const x = exact1(s); if (x !== null || !/^[a-z]/.test(s)) return x;
    const y = exact1(s[0].toUpperCase() + s.slice(1)); return y !== null ? y : exact1(s.replace(/\b[a-z]/g, c => c.toUpperCase()));
  };
  function tr(s, depth) {
    const x = exact(s);
    if (x !== null) return x;
    if (depth > 3 || !/[A-Za-z]/.test(s)) return s;
    const e = /^((?:\p{Extended_Pictographic}|\uFE0F|\u200D)+ )(.+)$/u.exec(s); // an icon in front ("😊 Stay happy...")
    if (e) { const t = tr(e[2], depth + 1); return t === e[2] ? s : e[1] + t; }
    const m = /^(Senior|Lead|Head|Chief) (.+)$/.exec(s);
    if (m && I.has(`g:${m[1]} *`)) { const t = tr(m[2], depth + 1); if (t !== m[2] || exact(m[2]) !== null) return I.t(`g:${m[1]} *`, { title: t }); } // a title the same in both languages ("Barista") still takes the rank
    for (const [re, tpl] of sentences[lang] || []) {
      const r = re.exec(s);
      if (r) return tpl.replace(/\{(\d)\}/g, (y, n) => (r[n] === undefined ? '' : tr(r[n], depth + 1)));
    }
    // A sentence in lower case after a name (the newspaper writes "Aina Rahman welcomed baby..."): the name
    // as it is, then the sentence with a capital, as the engine first wrote it.
    if (depth === 0) {
      const nm = /^(\p{Lu}[\p{L}'’.\-]*(?: \p{Lu}[\p{L}'’.\-]*){0,3}) (\p{Ll}.*)$/u.exec(s);
      if (nm) { const rest = nm[2][0].toUpperCase() + nm[2].slice(1), t = tr(rest, depth + 1); if (t !== rest) return nm[1] + (dict[lang] && typeof dict[lang]['i18n.nameSep'] === 'string' ? dict[lang]['i18n.nameSep'] : '') + t; } // i18n.nameSep: what stands between the name and the sentence
    }
    return s;
  }
  const look = s => {
    if (typeof s !== 'string' || lang === 'en' || !s) return s;
    const k = `${lang}\u0001${s}`;
    let v = cache.get(k);
    if (v === undefined) { if (cache.size > 30000) cache.clear(); v = tr(s, 0); cache.set(k, v); }
    return v;
  };
  I.g = look;
  // Whether the language lists this data name itself (it may be spelt as in English: "Barista", "Halloween").
  I.hasName = s => typeof s === 'string' && lang !== 'en' && exact(s) !== null;
  // Sentences (PL-17 step 5): the engine keeps writing plain English into its records (the fingerprints and
  // saves read that text, so it never changes). When a record is shown in another language, a table of
  // sentence patterns (js/i18n/<lang>-sentences.js) maps the English sentence to that language: each pattern
  // is [RegExp, template]; {1}, {2}... in the template are the pattern's groups, each passed through the
  // glossary (names and numbers come through unchanged). No pattern: the English is shown as it is.
  const sentences = {};
  I.sentences = (code, list) => { (sentences[code] = sentences[code] || []).push(...list); cache.clear(); };
  I.sentencesOf = code => (sentences[code] || []).slice();
  I.sentence = look; // the same lookup: a sentence, or a short name (an activity, a place)
  I.ev = (eventId, part, params) => I.t(`ev.${eventId}.${part}`, params);
  // A saved text record: an old plain English string, or { key, params } written by newer code.
  I.render = rec => (rec && typeof rec === 'object' && rec.key ? I.t(rec.key, rec.params) : I.sentence(String(rec === undefined || rec === null ? '' : rec)));
  // Numbers and percentages in the reader's language (money stays with the country pack: U.fmtMoney).
  I.num = (n, opts) => { try { return new Intl.NumberFormat(lang, opts).format(n); } catch (e) { return String(n); } };

  // Switch language: loads its dictionary if needed, then calls done(). Never throws; an unknown language
  // falls back to English.
  I.set = function (code, done) {
    if (!I.LANGS.some(l => l[0] === code)) code = I.DEFAULT;
    const finish = () => {
      lang = code;
      if (typeof document !== 'undefined') { document.documentElement.lang = code; I.apply(document); try { window.dispatchEvent(new Event('les-lang')); } catch (e) { /* old browser */ } }
      try { localStorage.setItem('les-lang', code); } catch (e) { /* private window */ }
      if (done) done(code);
    };
    if (code === 'en' || I.loaded(code) || typeof document === 'undefined') { finish(); return; }
    const s = document.createElement('script');
    s.src = `js/i18n/${code}.js`;
    s.onload = () => { const s2 = document.createElement('script'); s2.src = `js/i18n/${code}-sentences.js`; s2.onload = finish; s2.onerror = finish; document.head.appendChild(s2); }; // and its sentence patterns
    s.onerror = () => { code = I.DEFAULT; finish(); };
    document.head.appendChild(s);
  };
  I.saved = () => { try { return localStorage.getItem('les-lang') || I.DEFAULT; } catch (e) { return I.DEFAULT; } };

  // Static markup: elements with data-i18n="key" get their text, data-i18n-title their tooltip.
  I.apply = function (root) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = I.t(el.dataset.i18n);
    for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = I.t(el.dataset.i18nTitle);
    for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', I.t(el.dataset.i18nAria));
    for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = I.t(el.dataset.i18nPlaceholder);
  };

  // Checks for tests and translators: every key of a language exists in English, and uses exactly English's
  // placeholders (a missing or misspelt {name} would show raw or drop a value).
  I.validate = function (code) {
    const out = [], ph = s => (typeof s === 'string' ? [s] : Object.values(s || {})).flatMap(x => String(x).match(/\{\w+\}/g) || []).sort().join(',');
    for (const [k, v] of Object.entries(dict[code] || {})) {
      if (!I.has(k, 'en')) { out.push(`${code}: unknown key ${k}`); continue; }
      const a = [...new Set(ph(dict.en[k]).split(','))].join(','), b = [...new Set(ph(v).split(','))].join(',');
      if (a !== b) out.push(`${code}: ${k} placeholders ${b || 'none'} vs English ${a || 'none'}`);
    }
    return out;
  };
  // Share of English keys a language covers, per namespace (for the completeness gate).
  I.coverage = function (code) {
    const ns = {};
    for (const k of Object.keys(dict.en)) { const n = k.split('.')[0], c = ns[n] = ns[n] || { done: 0, total: 0 }; c.total++; if (I.has(k, code)) c.done++; }
    return ns;
  };
  // For the translation tools (tools/i18n-check.py): every English text the game can show, so a screen in any
  // language can be checked for text still in English. texts: key -> English value(s); names: the English
  // data names some language's glossary covers; patterns: the English sentence patterns of every language.
  I.sources = function () {
    const names = new Set(), patterns = [];
    for (const m of Object.values(gloss)) for (const k of Object.keys(m)) names.add(k);
    for (const k of Object.keys(dict.en)) if (k.startsWith('g:')) names.add(k.slice(2));
    for (const list of Object.values(sentences)) for (const [re] of list) patterns.push(re);
    return { texts: Object.assign({}, dict.en), names: [...names], patterns };
  };
  I.textOf = (code, key) => (dict[code] || {})[key]; // a language's own value for a key (undefined: none)
})(globalThis.LES = globalThis.LES || {});
