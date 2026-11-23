// Screen scanner for translations (run by tools/i18n-check.py in headless Edge on index.html; developer tool).
// Starts a world in the chosen language for each country, opens every tab, a spread of people, every kind of
// building and every dialog, and lists text on screen that is still English. Settings: window.SCAN =
// { lang, countries, years, stage }. Two ways to spot English, so it works for any language:
//  - known English: the text (or a part of it) is one of the game's English texts, a data name, or matches an
//    English sentence pattern (LES.I18n.sources()); this catches English in Spanish as well as in Chinese;
//  - for Chinese, Japanese and Korean also any Latin word that is not a name or an allowed abbreviation.
// People, towns, businesses, gangs and listed companies are names and are not reported.
await (async () => {
  const S = Object.assign({ lang: 'zh-Hans', countries: ['my', 'uk', 'us', 'cn'], years: 10, stage: 'adult' }, window.SCAN || {});
  const app = window.LES_APP, UI = LES.UI, P = LES.P, I = LES.I18n;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Load every language once, so the English inventory includes every glossary and pattern there is.
  for (const [code] of I.LANGS) if (code !== 'en') await new Promise(r => I.set(code, r));
  await new Promise(r => I.set(S.lang, r));
  if (I.lang() !== S.lang) return `Unknown language ${S.lang} (known: ${I.LANGS.map(l => l[0]).join(', ')})`;
  const cjk = /^(zh|ja|ko)/.test(S.lang);

  // ---- The English inventory ----
  const src = I.sources(), exact = new Set(), templates = [];
  const sameOk = new Set(); // English texts the language keeps as they are (its own value is identical)
  for (const [k, v] of Object.entries(src.texts)) {
    for (const e of typeof v === 'string' ? [v] : Object.values(v || {})) {
      if (typeof e !== 'string') continue;
      const own = I.textOf(S.lang, k), ownList = own === undefined ? [] : typeof own === 'string' ? [own] : Object.values(own);
      if (S.lang !== 'en' && ownList.includes(e)) { sameOk.add(e); continue; }
      const t = e.trim().replace(/[.!?]+$/, ''); // a full stop at the end is optional when matching
      if (!/\{\w+\}/.test(t)) { if ((t.match(/[A-Za-z]/g) || []).length >= 3) exact.add(t); continue; }
      const lit = t.replace(/\{\w+\}/g, ''); if ((lit.match(/[A-Za-z]/g) || []).length < 3) continue; // "{a} · {b}" would match anything
      const re = '^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '(.+?)') + '[.!?]?$';
      try { templates.push(new RegExp(re)); } catch (err) { /* skip */ }
    }
  }
  for (const n of src.names) if ((n.match(/[A-Za-z]/g) || []).length >= 3) exact.add(n);
  // Patterns with almost no fixed English words ("{1} / {2}") would match text in any language: left out.
  const patterns = src.patterns.filter(re => (re.source.replace(/\((?:\?:)?[^()]*\)|\\[a-z]|[^A-Za-z]/g, '').length >= 3));
  // English dates as the engine (and an untranslated screen) writes them: "5 Feb Y2", "Feb Y2"
  const DATE = /^(\d{1,2} )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) Y-?\d+$/;
  const memo = new Map();
  const knownEnglish = s => {
    let v = memo.get(s);
    if (v === undefined) { v = !sameOk.has(s) && (exact.has(s) || DATE.test(s) || templates.some(re => re.test(s)) || patterns.some(re => re.test(s))); memo.set(s, v); }
    return v;
  };

  // ---- Names (never reported) ----
  const ALLOW = new Set(['RM', 'B40', 'M40', 'T20', 'EPF', 'SPM', 'STPM', 'PT3', 'UPSR', 'GCSE', 'GCSEs', 'BTEC', 'SAT', 'GPA', 'NHS', 'CPF', 'GDP', 'CEO', 'CPI', 'MAX', 'Bursa', 'PhD', 'IQ', 'OK', 'AI', 'MBA', 'GP', 'HR', 'IT', 'PE', 'UK', 'US', 'USA', 'KL', 'LA', 'LES', 'CSV', 'PDF', 'Esc', 'KTV', 'SUV', 'Excel', 'softmax']);
  const names = new Set();
  const addNames = w => {
    const put = s => String(s || '').split(/[\s\-'’]+/).forEach(x => x && names.add(x));
    for (const p of w.people) put(P.name(p));
    try { put(LES.townName(w)); } catch (e) { /* no town name */ }
    for (const b of w.town.buildings) put(b.label);
    for (const b of w.biz || []) put(b.name);
    const deep = (o, d) => { if (!o || d > 3 || typeof o !== 'object') return; for (const k in o) { const v = o[k]; if (k === 'name' && typeof v === 'string') put(v); else if (typeof v === 'object' && !/^(people|living|feed|town|log)$/.test(k)) deep(v, d + 1); } };
    deep(w.crime, 0); deep(w.gov, 0); deep(w.market, 0); deep(w.news, 0);
    const pk = LES.Countries.pack; for (const k of ['stocks', 'ipoPool', 'glcStocks']) for (const s of (pk.content && pk.content[k]) || []) { put(s.name); put(s.tk); }
  };
  const latinLeft = s => {
    const words = s.match(/[A-Za-z][A-Za-z'’]*/g) || [];
    const left = words.filter(x => !names.has(x) && !names.has(x.replace(/['’]s$/, '')) && !ALLOW.has(x) && !/^[A-Z]{2,6}$/.test(x) && !/^(x|Y|s|k|km|kg|h|m|d|am|pm|vs|bn|tn)$/.test(x));
    return left.length && left.join('').length >= 3;
  };
  const onlyNames = s => (s.match(/[A-Za-z][A-Za-z'’]*/g) || []).every(x => names.has(x) || names.has(x.replace(/['’]s$/, '')) || ALLOW.has(x) || /^[A-Z]{2,6}$/.test(x));
  const isEnglish = part => {
    if (!/[A-Za-z]{2}/.test(part) || onlyNames(part)) return false;
    // without an icon, quote or dash in front, or a key hint or punctuation at the end ("✨ Moved to ...", "More ▾")
    const bare = part.replace(/ \(key \w+\)$/, '').replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9)%]+$/, '');
    if (knownEnglish(part) || knownEnglish(bare)) return true;
    return cjk && latinLeft(part.replace(/（[^（）]*）/g, '')); // in Chinese an English explanation in brackets is intended
  };

  // ---- Walking the screen ----
  const OUT = {}, MISSED = new Map(); // MISSED (--missed): text with Latin words that was not reported, to check the detector
  let country, where;
  const grab = root => {
    if (!root) return;
    const o = OUT[country];
    const take = (txt, tag) => {
      txt = String(txt || '').replace(/\s+/g, ' ').trim();
      if (!txt || !/[A-Za-z]{2}/.test(txt)) return;
      const parts = [txt, ...txt.split(/(?<=[。！？；])|\s·\s|\s\|\s|\s—\s|：/).map(x => x.trim()).filter(x => x && x !== txt)];
      const hit = parts.find(isEnglish);
      if (!hit) { if (S.missed && tag !== 'whole' && /[A-Za-z]{3}/.test(txt) && !onlyNames(txt)) MISSED.set([...txt].slice(0, 120).join(''), where); return; }
      const k = [...txt].slice(0, 160).join('');
      if (!o[k]) o[k] = { n: 0, where: new Set() };
      o[k].n++; o[k].where.add(where + (tag ? `(${tag})` : ''));
    };
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = tw.currentNode; n; n = tw.nextNode()) {
      if (n.nodeType === 3) { const pe = n.parentElement; if (pe && !/^(SCRIPT|STYLE)$/.test(pe.tagName) && !pe.closest('.hidden,[hidden]')) take(n.nodeValue); }
      else if (n.getAttribute) {
        for (const a of ['title', 'aria-label', 'placeholder']) if (n.getAttribute(a)) take(n.getAttribute(a), a);
        // a sentence split by bold or small tags ("Body ages from <b>60</b> ..."): its whole text as well
        const kids = [...n.childNodes];
        if (kids.some(k => k.nodeType === 3 && /[A-Za-z]{2}/.test(k.nodeValue)) && kids.some(k => k.nodeType === 1) && kids.every(k => k.nodeType !== 1 || /^(B|I|SMALL|SPAN|A|STRONG|EM)$/.test(k.tagName)) && !n.closest('.hidden,[hidden]')) take(n.textContent, 'whole');
        if (n.tagName === 'OPTION' && !(n.parentElement && n.parentElement.id === 'set-lang')) take(n.textContent, 'opt');
      }
    }
  };
  const modal = () => document.getElementById('modal');
  const hide = () => { const m = modal(); if (m) m.classList.add('hidden'); };

  for (const c of S.countries) {
    country = c; OUT[c] = {};
    const cfg = Object.assign({}, LES.DEFAULTS, LES.Countries.get(c).defaults || {}, { country: c, seed: `scan-${c}`, founders: 150, play: 'random', playStage: S.stage });
    LES.Countries.ensure(cfg);
    hide();
    app.newWorld(cfg);
    const w = app.world;
    for (let d = 0; d < 365 * S.years; d++) w.step();
    addNames(w);
    where = 'shell'; UI.update(true); grab(document.getElementById('topbar')); grab(document.getElementById('tabs'));
    for (const tab of ['life', 'person', 'leaders', 'feed', 'place', 'stats', 'society', 'crime', 'gov']) {
      where = tab; UI.setTab(tab); UI.update(true); await sleep(30); grab(document.getElementById(`tab-${tab}`));
      for (const b of [...document.querySelectorAll(`#tab-${tab} .seg button, #tab-${tab} [data-sort], #tab-${tab} [data-filter]`)].slice(0, 14)) {
        try { b.click(); UI.update(true); await sleep(10); where = `${tab}:${(b.textContent || '').trim().slice(0, 12)}`; grab(document.getElementById(`tab-${tab}`)); } catch (e) { /* a button that needs more state */ }
      }
    }
    // Play a Life: the three views and every page
    UI.setTab('life');
    for (const v of ['A', 'B', 'C']) {
      UI.lifeView = v; UI.lifePage = null; UI._lifeHtml = null; UI.update(true);
      try { if (UI.renderStory) UI.renderStory(); if (UI.renderPlanner) UI.renderPlanner(); } catch (e) { /* view not available */ }
      where = `life:${v}`; grab(document.getElementById('tab-life')); document.querySelectorAll('.life-story,.life-planner,#life-story,#life-planner').forEach(grab);
      for (const pg of [...document.querySelectorAll('#tab-life [data-page]')].map(b => b.dataset.page)) {
        UI.lifePage = pg; UI._lifeHtml = null; UI.update(true); where = `life:${v}:${pg}`; grab(document.getElementById('tab-life'));
        const sp = document.querySelector('#tab-life [data-schoolpage]'); if (sp) { sp.click(); UI.update(true); where = 'life:school'; grab(document.getElementById('tab-life')); }
      }
    }
    UI.lifeView = 'A'; UI.lifePage = null; UI._lifeHtml = null;
    // People: one of each job, alive or dead, adult or child, with or without a record
    const seen = new Set(), ppl = [];
    for (const p of w.people) { const k = `${p.job && (p.job.title || p.job.kind)}|${p.alive}|${p.adult}|${!!p.cr}`; if (!seen.has(k)) { seen.add(k); ppl.push(p.id); } }
    for (const id of ppl.slice(0, 90)) { try { app.select(id, false); UI.setTab('person'); UI.update(true); where = 'person'; grab(document.getElementById('tab-person')); } catch (e) { /* skip */ } }
    // Every kind of building
    const kinds = new Set();
    for (const b of w.town.buildings) { if (kinds.has(b.kind)) continue; kinds.add(b.kind); try { UI.showBuilding(b.id); UI.update(true); where = `place:${b.kind}`; grab(document.getElementById('tab-place')); } catch (e) { /* skip */ } }
    // Dialogs: newspaper (a few issues back), stock market, Fate, My Cast, comparison, setup, report
    try { LES.NewsUI.open(app); for (let i = 0; i < 6; i++) { where = 'news'; grab(modal()); const prev = [...modal().querySelectorAll('button')].find(b => /‹|←/.test(b.textContent)); if (!prev) break; prev.click(); await sleep(10); } } catch (e) { OUT[c][`ERROR news: ${e.message}`] = { n: 1, where: new Set() }; }
    hide();
    try { UI.openBursa(); if (UI.renderBursa) UI.renderBursa(); where = 'market'; grab(modal()); } catch (e) { /* no market */ }
    hide(); UI.bursaOpen = false;
    try { app.askFate(w.living.find(p => p.alive && p.adult).id); where = 'fate'; grab(modal()); } catch (e) { /* skip */ }
    hide();
    try { UI.openCastCreator(-1); where = 'cast'; grab(modal()); } catch (e) { /* skip */ }
    hide();
    try { LES.Compare.open(app); where = 'compare'; grab(modal()); } catch (e) { /* needs an earlier run */ }
    hide();
    try { LES.Setup.open(app, false); for (const d of modal().querySelectorAll('details')) d.open = true; where = 'setup'; grab(modal()); } catch (e) { /* skip */ }
    hide();
    try { LES.Report.open(w, null); where = 'report bar'; grab(document.querySelector('#report-overlay .report-bar')); where = 'report'; grab(new DOMParser().parseFromString(LES.Report.html(w, null, true), 'text/html').body); LES.Report.close(); } catch (e) { OUT[c][`ERROR report: ${e.message}`] = { n: 1, where: new Set() }; }
    where = 'toasts'; grab(document.getElementById('toasts'));
  }
  const rows = [];
  for (const c of Object.keys(OUT)) for (const [k, v] of Object.entries(OUT[c]).sort((a, b) => b[1].n - a[1].n)) rows.push(`${c}\t${v.n}\t${[...v.where].slice(0, 3).join(',')}\t${k}`);
  if (S.missed) rows.push(...[...MISSED].map(([t, w]) => `missed\t0\t${w}\t${t}`));
  return rows.join('\n');
})()
