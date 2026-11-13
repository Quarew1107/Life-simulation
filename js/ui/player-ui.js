// Play a Life: the "My life" tab (PL-04). Who you are, decisions waiting, what you can do, and your journal.
// Everything you do here becomes a request (LES.Player.request / choose / pass) carried out when the next day
// starts; nothing here changes the world directly. All text goes through LES.I18n.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, UI = LES.UI, Pl = LES.Player, esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p);
  const $ = id => document.getElementById(id);
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } };
  UI.lifeCat = 'work';

  const where = () => { const app = UI.app; return Pl.town(app.region || app.world); };

  function status(w, p) {
    if (!p.alive) return T('life.status.dead');
    if (p.inst) return T('life.status.held');
    if (p.job) return T('life.status.job', { job: p.job.title, pay: U.fmtMoney(p.job.salary) });
    if (p.manages >= 0 && w.biz[p.manages]) return T('life.status.owner', { biz: w.biz[p.manages].name });
    if (p.enrol) return T('life.status.study');
    if (p.retired) return T('life.status.retired');
    if (!p.adult) return Math.floor(P.age(w, p)) < 5 ? T('life.status.home') : T('life.status.school');
    return T('life.status.seeking');
  }
  const bar = (label, v, cls) => `<div class="life-stat"><span>${esc(label)}</span><div class="life-bar ${cls || ''}"><i style="width:${U.clamp(Math.round(v), 0, 100)}%"></i></div><b>${Math.round(v)}</b></div>`;

  // Categories by life stage: only Work does something so far; the others say so honestly.
  const CATS = ['work', 'learn', 'money', 'love', 'health', 'community'];
  const catsFor = stage => (stage === 'baby' ? ['care'] : stage === 'child' || stage === 'teen' ? ['care', 'learn'] : CATS);
  // Babies and children: who looks after them, and reaching for them (the carer decides).
  function careHtml(w, p) {
    if (p.guardian === 'WELFARE') return `<p>${esc(T('care.welfare'))}</p><p class="note">${esc(T('care.note'))}</p>`;
    const carers = (p.caregivers || []).map(id => w.people[id]).filter(q => q && q.alive), g = Pl.carerOf(w, p);
    const asked = w.player.pending.some(c => c.kind === 'ASK_CARE');
    return `<p>${esc(T('care.by', { names: carers.map(q => P.name(q)).join(', ') || '—' }))}</p>
      ${g ? `<button class="ghost" data-care="1" ${asked ? 'disabled' : ''}>${esc(T('care.reach', { carer: P.name(g) }))}</button>` : ''}
      <p class="note">${esc(T('care.note'))}</p>`;
  }
  function workHtml(w, p) {
    if (!p.adult) return `<p class="muted">${esc(T('cat.youngWork'))}</p>`;
    const s = w.player, apps = s.apps || [], waiting = s.pending.filter(c => c.kind === 'APPLY_JOB').map(c => c.args.vac);
    const list = Pl.openings(w, p, true).slice(0, 8);
    const when = v => { const d = v.closeDay - w.day; return d > 0 ? T('time.inDays', { count: d }) : T('time.today'); };
    return `${apps.length ? `<h4>${esc(T('jobs.yourApps'))}</h4><ul class="list-plain">${apps.map(a => `<li><span>📄 ${esc(a.title)} · ${U.fmtMoney(a.salary)}</span><span class="muted">${esc(T('jobs.decides', { when: a.closeDay > w.day ? T('time.inDays', { count: a.closeDay - w.day }) : T('time.today') }))}</span></li>`).join('')}</ul>` : ''}
      <h4>${esc(T('jobs.openings'))}</h4>
      ${list.length ? `<ul class="list-plain life-jobs">${list.map(v => {
        const applied = v.appSet.has(p.id), queued = waiting.includes(v.id);
        return `<li><span><b>${esc(v.job.title)}</b> · ${U.fmtMoney(v.salary)}<br><small class="muted">${esc(T('jobs.closes', { when: when(v) }))}</small></span>
          ${applied ? `<span class="muted">✓ ${esc(T('jobs.applied'))}</span>` : queued ? `<span class="muted">⏳ ${esc(T('jobs.waiting'))}</span>` : `<button class="ghost small" data-apply="${v.id}">${esc(T('jobs.apply'))}</button>`}</li>`;
      }).join('')}</ul>` : `<p class="muted">${esc(T('jobs.none'))}</p>`}
      <p class="note">${esc(T('jobs.note'))}</p>`;
  }

  function decisionsHtml(w) {
    const inbox = w.player.inbox || [];
    if (!inbox.length) return `<p class="muted">${esc(T('life.noDecisions'))}</p>`;
    return inbox.map(item => {
      const e = Pl.eventById(item.ev), left = item.expires - w.day, ps = Object.assign({ name: P.name(Pl.person(w)) }, item.params || {});
      return `<div class="life-event" role="group" aria-label="${esc(T(`ev.${e.id}.title`))}">
        <div class="life-event-head"><b>${esc(T(`ev.${e.id}.title`, ps))}</b><small class="muted">${esc(T('life.daysLeft', { count: left }))}</small></div>
        <p>${esc(T(`ev.${e.id}.body`, ps))}</p>
        <div class="life-choices">${e.choices.map(c => `<button class="ghost" data-uid="${esc(item.uid)}" data-choice="${esc(c.id)}">${esc(T(`ev.${e.id}.${c.id}`, ps))}</button>`).join('')}
          <button class="link" data-pass="${esc(item.uid)}">${esc(T('life.delegate'))}</button></div>
      </div>`;
    }).join('');
  }

  function journalHtml(w) {
    const j = w.player.journal.slice(-40).reverse();
    if (!j.length) return `<p class="muted">${esc(T('journal.empty'))}</p>`;
    return `<ul class="list-plain life-journal">${j.map(e => `<li class="${e.imp >= 2 ? 'big' : ''}"><small class="muted">${U.fmtDate(e.day)}</small> ${esc(LES.I18n.render(e))}</li>`).join('')}</ul>`;
  }

  UI.renderLife = function () {
    const el = $('tab-life');
    if (!el) return;
    const w = where();
    if (!w) { el.innerHTML = `<div class="card"><p>${esc(T('life.none'))}</p></div>`; return; }
    if (w.player.waiting) { el.innerHTML = `<div class="card life-head"><div><div class="life-name">👶 ${esc(T('play.waiting'))}</div><p>${esc(T('life.waiting'))}</p></div></div>`; return; }
    const p = Pl.person(w), sm = Pl.summary(w), s = w.player;
    const mine = catsFor(sm.stage);
    if (!mine.includes(UI.lifeCat)) UI.lifeCat = mine[0];
    const cats = mine.map(k => `<button class="${UI.lifeCat === k ? 'on' : ''}" data-cat="${k}" aria-pressed="${UI.lifeCat === k}">${esc(T(`cat.${k}`))}</button>`).join('');
    el.innerHTML = `
      <div class="card life-head">
        <canvas class="portrait" id="life-portrait" width="64" height="88" aria-hidden="true"></canvas>
        <div><div class="life-name">${esc(sm.name)}</div>
          <div class="muted">${esc(T('life.ageStage', { age: sm.age, stage: T(`life.${sm.stage}`) }))}${UI.app.region ? ` · ${esc(LES.townName(w))}` : ''}</div>
          <div>${esc(status(w, p))}</div>
          ${p.adult || p.nw > 0 ? `<div class="life-money">${esc(T('life.cash'))} <b>${U.fmtMoney(p.cash)}</b> · ${esc(T('life.worth'))} <b>${U.fmtMoney(p.nw)}</b></div>` : ''}</div>
      </div>
      ${!p.alive ? `<div class="card"><p>${esc(T('life.dead', { name: sm.name }))}</p></div>` : `
      <div class="card">${bar(T('life.health'), p.health)}${bar(T('life.happy'), p.happy)}${bar(T('life.stress'), p.stress, 'bad')}</div>
      <div class="card"><h3>${esc(T('life.decisions'))}${(s.inbox || []).length ? ` <small class="life-count">${s.inbox.length}</small>` : ''}</h3>${decisionsHtml(w)}</div>
      <div class="card"><h3>${esc(T('life.actions'))}</h3><div class="life-cats" role="group">${cats}</div>
        <div class="life-cat-body">${UI.lifeCat === 'work' ? workHtml(w, p) : UI.lifeCat === 'care' ? careHtml(w, p) : `<p class="muted">${esc(T('cat.soon'))}</p>`}</div></div>`}
      <div class="card"><h3>${esc(T('journal.title'))}</h3>${journalHtml(w)}</div>
      <details class="card life-settings"><summary>${esc(T('life.settings'))}</summary>
        <label>${esc(T('freq.label'))} <select id="life-freq">${['important', 'balanced', 'detailed'].map(k => `<option value="${k}" ${(s.freq || 'balanced') === k ? 'selected' : ''}>${esc(T(`freq.${k}`))}</option>`).join('')}</select></label>
        <label><input type="checkbox" id="life-pause" ${pref('les-play-pause', '1') === '1' ? 'checked' : ''}> ${esc(T('life.pauseOn'))}</label>
        <p class="note">${esc(T('life.storyTip'))}</p></details>`;
    const c = $('life-portrait');
    if (c && p) {
      const g = c.getContext('2d'), age = P.age(w, p);
      g.imageSmoothingEnabled = false;
      const spr = LES.Sprites.person(LES.Sprites.lookOf(p, age), age < 3 ? 'baby' : !p.adult ? 'child' : age >= 65 ? 'elder' : 'adult', 0);
      const k = Math.floor(Math.min(60 / spr.width, 80 / spr.height));
      g.drawImage(spr, Math.round((64 - spr.width * k) / 2), Math.round((88 - spr.height * k) / 2), spr.width * k, spr.height * k);
    }
  };

  // Clicks in the tab (one listener; the tab is redrawn often).
  UI.initLife = function () {
    const el = $('tab-life');
    if (!el) return;
    const say = r => { if (r && r.error) UI.toast(esc(T(`cmd.error.${r.error}`))); else if (r && r.command) UI.toast(esc(T('jobs.queued'))); UI.update(true); };
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      const w = where();
      if (!b || !w) return;
      if (b.dataset.cat) { UI.lifeCat = b.dataset.cat; UI.update(true); }
      else if (b.dataset.apply) say(Pl.request(w, 'APPLY_JOB', { vac: Number(b.dataset.apply) }));
      else if (b.dataset.care) say(Pl.request(w, 'ASK_CARE', {}));
      else if (b.dataset.choice) say(Pl.choose(w, b.dataset.uid, b.dataset.choice));
      else if (b.dataset.pass) { Pl.pass(w, b.dataset.pass); UI.update(true); }
    });
    el.addEventListener('change', e => {
      const w = where();
      if (e.target.id === 'life-freq' && w) w.player.freq = e.target.value;
      if (e.target.id === 'life-pause') setPref('les-play-pause', e.target.checked ? '1' : '0');
    });
  };

  // New decisions: a toast that opens the tab, and (by default) a pause so nothing slips by unseen.
  const seen = new Set();
  UI.watchLife = function () {
    const app = UI.app, w = where(), tab = document.querySelector('#tabs button[data-tab="life"]');
    if (tab) tab.classList.toggle('hidden', !w);
    if (!w) return;
    if (UI._lifeWaiting && !w.player.waiting) { // Start at Birth: you have just been born
      UI._lifeWaiting = false; // first: focusPlayer redraws the panels, which comes back here
      const born = w.player.journal.find(e => e.key === 'life.born');
      if (born) UI.toast(`👶 ${esc(LES.I18n.render(born))}`, U.fmtDate(w.day), w.player.id, true);
      if (!app.paused) app.togglePause();
      app.focusPlayer();
    }
    UI._lifeWaiting = !!w.player.waiting;
    const inbox = w.player.inbox || [];
    if (tab) tab.dataset.count = inbox.length || '';
    for (const item of inbox) {
      if (seen.has(item.uid)) continue;
      seen.add(item.uid);
      if (w.day - item.day > 1) continue; // already there (a loaded save)
      const t = UI.toast(`📩 ${esc(T('life.newDecision', { title: T(`ev.${item.ev}.title`, item.params || {}) }))}`, U.fmtDate(w.day), -1, true);
      if (t) t.onclick = () => UI.setTab('life');
      if (pref('les-play-pause', '1') === '1' && !app.paused) app.togglePause();
    }
  };
})(globalThis.LES = globalThis.LES || {});
