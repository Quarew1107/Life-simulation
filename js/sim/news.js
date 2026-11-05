// The town newspaper (Phase 6): every month an issue is filed from the month's biggest stories in the
// feed and the town's numbers, so the archive outlives the feed (which keeps only the latest 800 items).
// Presentation only: no dice, nothing the simulation reads, not in the fingerprint. The paper's name comes
// from the country pack (names.newspaper). UI: js/ui/news-ui.js; the report prints a front page a decade.
(function (LES) {
  'use strict';
  const N = LES.News = {};
  N.MAX_ISSUES = 1500; // 125 years of monthly issues
  N.STORIES = 6;
  N.name = w => (LES.Countries.pack.names && LES.Countries.pack.names.newspaper) || `The ${LES.townName(w)} Times`;

  // The month's stories: most important first, then the latest; at most two about the same person.
  // A story about one person names them: 'Was assaulted' -> 'Aminah Yusof was assaulted'.
  N.headline = function (w, e) {
    const p = e.pid >= 0 ? w.people[e.pid] : null;
    if (!p || e.text.includes(p.first) || e.text.includes(p.last)) return e.text;
    return `${LES.P.name(p)} ${/^[A-Z][a-z]/.test(e.text) ? e.text[0].toLowerCase() + e.text.slice(1) : e.text}`;
  };
  N.pick = function (w, items) {
    const sorted = items.slice().sort((a, b) => (b.imp || 0) - (a.imp || 0) || b.day - a.day), out = [], per = {};
    for (const e of sorted) {
      if ((e.imp || 0) < 1) continue;
      if (e.pid >= 0 && (per[e.pid] = (per[e.pid] || 0) + 1) > 2) continue;
      out.push({ day: e.day, text: N.headline(w, e), cat: e.cat || 'life', imp: e.imp || 0, pid: e.pid === undefined ? -1 : e.pid });
      if (out.length >= N.STORIES) break;
    }
    return out;
  };

  N.file = function (w) {
    const news = w.news = w.news || { issues: [], lastDay: -1, last: null };
    const items = [];
    for (let i = w.feed.length - 1; i >= 0 && w.feed[i].day > news.lastDay; i--) items.push(w.feed[i]);
    const s = w.stats, prev = news.last || { births: 0, deaths: 0, bizStarted: 0, bizFailed: 0, immigrants: 0, emigrants: 0 };
    const now = { births: s.births, deaths: s.deaths, bizStarted: s.bizStarted, bizFailed: s.bizFailed, immigrants: s.immigrants || 0, emigrants: s.emigrants || 0 };
    const d = k => now[k] - (prev[k] || 0);
    news.issues.push({ no: news.issues.length ? news.issues[news.issues.length - 1].no + 1 : 1, day: w.day, stories: N.pick(w, items),
      births: d('births'), deaths: d('deaths'), opened: d('bizStarted'), closed: d('bizFailed'), arrived: d('immigrants'), left: d('emigrants') });
    if (news.issues.length > N.MAX_ISSUES) news.issues.shift();
    news.lastDay = w.day; news.last = now;
  };

  // The issue for a day (the last one filed on or before it).
  N.issueAt = function (w, day) {
    const is = (w.news && w.news.issues) || [];
    let lo = 0, hi = is.length - 1, best = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (is[m].day <= day) { best = m; lo = m + 1; } else hi = m - 1; }
    return best;
  };

  LES.Systems.register({ id: 'news', order: 200, month(w) { N.file(w); } });
})(globalThis.LES = globalThis.LES || {});
