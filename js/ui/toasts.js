// Pop-ups (toasts) over the map: the town's big events, your cast's news, save/load notices.
// - Small cards in the top-left corner of the map; at most 3 at once (the oldest fades out early).
// - Repeats of the same kind of event on the same day share one card ("Had a bag snatched — 5 cases today").
// - On narrow screens (< 600 px) CSS turns the stack into a one-line ticker showing only the newest.
// - Every pop-up remembers which world it came from: they are cleared when a new world starts,
//   a save is loaded or another town is opened, and a click only selects a person in that same world.
(function (LES) {
  'use strict';
  const UI = LES.UI, U = LES.U, P = LES.P;
  const esc = U.esc, $ = id => document.getElementById(id);
  const MAX_SHOWN = 3, LIFE_MS = 6000, BIG_LIFE_MS = 12000, FADE_MS = 300;
  const CAT_ICON = { wealth: '💰', biz: '🏪', career: '💼', edu: '🎓', family: '👪', luck: '🎲', death: '🕯️', economy: '📊', money: '💵', life: '🧭', goal: '🎯', migration: '🚆', crime: '🚨', politics: '🏛️' };

  let wired = false;
  function box() {
    const b = $('toasts');
    if (b && !wired) {
      wired = true;
      b.addEventListener('click', e => {
        const t = e.target.closest('.toast');
        if (!t) return;
        const pid = Number(t.dataset.pid);
        if (pid >= 0 && t._world === UI.app.world) UI.app.select(pid, true);
      });
    }
    return b;
  }

  function fade(t) {
    if (t._gone) return;
    t._gone = true;
    clearTimeout(t._timer);
    t.classList.add('out');
    setTimeout(() => t.remove(), FADE_MS);
  }
  function arm(t) {
    clearTimeout(t._timer);
    t._timer = setTimeout(() => fade(t), t._big ? BIG_LIFE_MS : LIFE_MS);
  }
  const live = () => [...box().children].filter(t => !t._gone);

  // Remove every pop-up at once (new world, loaded save, other town).
  UI.clearToasts = function () {
    const b = box();
    if (!b) return;
    for (const t of b.children) clearTimeout(t._timer);
    b.textContent = '';
  };

  // html: the message (already escaped); when: a date label; pid: person to select on click (-1: none);
  // big: an important event (stays longer, teal edge); key: pop-ups with the same key share one card.
  UI.toast = function (html, when, pid, big, key) {
    const b = box();
    if (!b) return null;
    if (key) {
      const same = live().find(t => t._key === key);
      if (same) { same.remove(); b.appendChild(same); return same; } // the caller updates its text
    }
    const t = document.createElement('div');
    t.className = `toast${big ? ' big' : ''}`;
    t.dataset.pid = pid === undefined ? -1 : pid;
    t._world = UI.app && UI.app.world;
    t._key = key || '';
    t._big = !!big;
    t._count = 0;
    t.innerHTML = `<span class="t">${esc(when || '')}</span> <span class="m">${html}</span>`;
    t.title = t.textContent.trim();
    b.appendChild(t);
    arm(t);
    const shown = live();
    for (let i = 0; i < shown.length - MAX_SHOWN; i++) fade(shown[i]);
    return t;
  };

  // Same kind of event: same day, category and wording once names, numbers and amounts are removed.
  function groupKey(w, e, name) {
    let text = e.text;
    if (name) text = text.split(name).join('');
    text = text.replace(/\([^)]*\)/g, '').replace(/[\d.,%]+/g, '#').replace(/\s+/g, ' ').trim();
    return `${e.day}|${e.cat}|${e.pid >= 0 ? 'p' : 'n'}|${text}`;
  }
  // "Rizal won the election" rather than "Rizal — Rizal won the election".
  function line(w, e, n) {
    const p = e.pid >= 0 ? w.people[e.pid] : null, name = p ? P.name(p) : '';
    const icon = CAT_ICON[e.cat] || '';
    if (n > 1 && p && !e.text.includes(name)) // "Had a bag snatched — 5 cases today (latest: Aina)"
      return `${icon} ${esc(e.text.replace(/\s*\([^)]*\)/g, ''))} — <b>${n} cases</b> today (latest: <b>${esc(name)}</b>)`;
    const more = n > 1 ? ` <b>(×${n} today)</b>` : '';
    if (!p) return `${icon} ${esc(e.text)}${more}`;
    if (e.text.includes(name)) return `${icon} ${esc(e.text).split(esc(name)).join(`<b>${esc(name)}</b>`)}${more}`;
    return `${icon} <b>${esc(name)}</b> — ${esc(e.text)}${more}`;
  }

  // Called from the main loop (throttled): new feed events become pop-ups, director shots, sounds.
  UI.checkToasts = function () {
    const app = UI.app, w = app.world;
    const news = w.feed.filter(e => e.seq > UI.feedSeqShown), fresh = news.filter(e => e.imp >= 2);
    for (const e of fresh) if (e.pid >= 0) UI.director.queue.push(e);
    if (w.feed.length) UI.feedSeqShown = Math.max(UI.feedSeqShown, w.feed[w.feed.length - 1].seq || 0);
    for (const e of news) LES.Audio.onEvent(e, app);
    if (UI.castAlerts) UI.castAlerts(app);
    if (!fresh.length) return;
    // Group this batch first, so a busy day becomes a few cards instead of dozens.
    const groups = new Map();
    for (const e of fresh) {
      const p = e.pid >= 0 ? w.people[e.pid] : null;
      const k = groupKey(w, e, p ? P.name(p) : '');
      const g = groups.get(k);
      if (g) { g.n++; g.last = e; } else groups.set(k, { k, n: 1, last: e });
    }
    for (const g of [...groups.values()].slice(-MAX_SHOWN)) {
      const e = g.last;
      const t = UI.toast('', U.fmtDate(e.day), e.pid, e.imp >= 3, g.k);
      if (!t) continue;
      t._count += g.n;
      t.dataset.pid = e.pid;
      t.querySelector('.m').innerHTML = line(w, e, t._count);
      t.title = t.textContent.trim();
      arm(t);
    }
  };
})(globalThis.LES = globalThis.LES || {});
