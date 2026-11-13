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
  I.LANGS = [['en', 'English'], ['zh-Hans', '简体中文']]; // later: es, ja, ko
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
  const fill = (s, params) => s.replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? val(params[k]) : m));
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
  I.ev = (eventId, part, params) => I.t(`ev.${eventId}.${part}`, params);
  // A saved text record: an old plain English string, or { key, params } written by newer code.
  I.render = rec => (rec && typeof rec === 'object' && rec.key ? I.t(rec.key, rec.params) : String(rec === undefined || rec === null ? '' : rec));
  // Numbers and percentages in the reader's language (money stays with the country pack: U.fmtMoney).
  I.num = (n, opts) => { try { return new Intl.NumberFormat(lang, opts).format(n); } catch (e) { return String(n); } };

  // Switch language: loads its dictionary if needed, then calls done(). Never throws; an unknown language
  // falls back to English.
  I.set = function (code, done) {
    if (!I.LANGS.some(l => l[0] === code)) code = I.DEFAULT;
    const finish = () => {
      lang = code;
      if (typeof document !== 'undefined') { document.documentElement.lang = code; I.apply(document); }
      try { localStorage.setItem('les-lang', code); } catch (e) { /* private window */ }
      if (done) done(code);
    };
    if (code === 'en' || I.loaded(code) || typeof document === 'undefined') { finish(); return; }
    const s = document.createElement('script');
    s.src = `js/i18n/${code}.js`;
    s.onload = finish;
    s.onerror = () => { code = I.DEFAULT; finish(); };
    document.head.appendChild(s);
  };
  I.saved = () => { try { return localStorage.getItem('les-lang') || I.DEFAULT; } catch (e) { return I.DEFAULT; } };

  // Static markup: elements with data-i18n="key" get their text, data-i18n-title their tooltip.
  I.apply = function (root) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = I.t(el.dataset.i18n);
    for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = I.t(el.dataset.i18nTitle);
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
})(globalThis.LES = globalThis.LES || {});
