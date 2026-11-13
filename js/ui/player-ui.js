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
  const catsFor = stage => (stage === 'baby' ? ['care'] : stage === 'child' || stage === 'teen' ? ['care', 'learn', 'friends'] : CATS);
  // Children and teens: study pace, a club, pocket money (carers decide and pay).
  function learnHtml(w, p) {
    const s = w.player, eff = s.effort || 'steady', g = Pl.carerOf(w, p), waiting = k => s.pending.some(c => c.kind === k);
    const effBtns = ['relaxed', 'steady', 'hard'].map(k => `<button class="${eff === k ? 'on' : ''}" data-effort="${k}" aria-pressed="${eff === k}" ${P.age(w, p) < 6 ? 'disabled' : ''}>${esc(T(`effort.${k}`))}</button>`).join('');
    const club = s.club ? `<p>${esc(T('learn.inClub', { club: T(`club.${s.club.id}`) }))} <button class="link" data-quitclub="1">${esc(T('learn.quit'))}</button></p>`
      : `<p class="muted">${esc(T('learn.noClub', { fee: U.fmtMoney(Pl.clubFee(w)) }))}</p><div class="life-cats">${Object.keys(Pl.CLUBS).map(k => `<button data-club="${k}" ${waiting('ASK_CLUB') ? 'disabled' : ''}>${esc(T(`club.${k}`))}</button>`).join('')}</div>`;
    const al = s.allowance, payer = al && w.people[al.payer];
    const allow = al ? `<p>${esc(T('learn.allowYes', { amt: U.fmtMoney(al.amt), carer: payer ? P.name(payer) : '' }))}</p>`
      : `<p class="muted">${esc(T('learn.allowNo'))}</p>${g && P.age(w, p) >= 6 ? `<button class="ghost small" data-allow="0" ${waiting('ASK_ALLOWANCE') ? 'disabled' : ''}>${esc(T('learn.askAllow'))}</button> <button class="ghost small" data-allow="1" ${waiting('ASK_ALLOWANCE') ? 'disabled' : ''}>${esc(T('learn.askChores'))}</button>` : ''}`;
    // School (from 7): what you attend now, and the four kinds you can ask for (the carers decide).
    let school = '';
    if (P.age(w, p) >= 7 && Pl.schoolOffers) {
      const cur = Pl.currentTier(w, p), asked = waiting('ASK_SCHOOL');
      school = `<h4>${esc(T('learn.school'))}</h4><p>${esc(T('learn.schoolNow', { school: T(`school.${cur}`) }))}</p><ul class="list-plain life-jobs">${Pl.schoolOffers(w, p).map(o => `<li><span><b>${esc(T(`ev.TE-001.${o.tier}`))}</b><br><small class="muted">${o.why === 'none' ? esc(T('learn.none')) : o.fee ? esc(T('learn.schoolFee', { fee: U.fmtMoney(o.fee) })) : esc(T('learn.free'))}${o.why === 'cost' ? ` · ${esc(T('learn.cost'))}` : ''}</small></span>${o.tier === cur ? '<span class="muted">✓</span>' : o.why === 'none' ? '' : `<button class="ghost small" data-school="${o.tier}" ${asked || p.guardian === 'WELFARE' ? 'disabled' : ''}>${esc(T('learn.askSchool'))}</button>`}</li>`).join('')}</ul><p class="note">${esc(T('learn.schoolNote'))}</p>`;
    }
    const plan = P.age(w, p) >= 14 ? `<h4>${esc(T('learn.plan'))}</h4><p class="muted">${s.plan ? esc(T('learn.planNow', { plan: T(`plan.${s.plan}`) })) : esc(T('learn.planNone'))}</p><div class="life-cats">${['degree', 'vocational', 'work'].map(k => `<button class="${s.plan === k ? 'on' : ''}" data-plan="${k}">${esc(T(`plan.${k}`))}</button>`).join('')}</div>` : '';
    return `${school}<h4>${esc(T('learn.effort'))}</h4><div class="life-cats" role="group">${effBtns}</div><h4>${esc(T('learn.club'))}</h4>${club}<h4>${esc(T('learn.allowance'))}</h4>${allow}${plan}<p class="note">${esc(T('learn.note'))}</p>`;
  }
  // Adults: courses (real admission and places), current studies.
  function adultLearnHtml(w, p) {
    const s = w.player;
    if (p.enrol) { const c = LES.C.COURSE_BY_ID[p.enrol.course]; return `<p>${esc(T('learn.studying', { course: c ? c.name : p.enrol.course }))}</p><button class="ghost small" data-dropout="1">${esc(T('learn.drop'))}</button><p class="note">${esc(T('learn.adultNote'))}</p>`; }
    const list = Pl.courses ? Pl.courses(w, p).slice(0, 8) : [];
    return `<h4>${esc(T('learn.courses'))}</h4>${list.length ? `<ul class="list-plain life-jobs">${list.map(c => `<li><span><b>${esc(c.name)}</b><br><small class="muted">${esc(T('learn.months', { months: c.months }))} · ${esc(T('learn.schoolFee', { fee: U.fmtMoney(c.fee) }))} · ${esc(T('learn.chance', { pct: Math.round(c.chance * 100) }))}</small></span><button class="ghost small" data-enroll="${c.id}" ${s.pending.some(x => x.kind === 'ENROLL') ? 'disabled' : ''}>${esc(T('learn.apply'))}</button></li>`).join('')}</ul>` : `<p class="muted">—</p>`}<p class="note">${esc(T('learn.adultNote'))}</p>`;
  }
  // Adults: cash, the index fund, and the home.
  function moneyHtml(w, p) {
    const s = w.player, C = LES.C, busy = k => s.pending.some(c => c.kind === k), cur = p.tiers.housing;
    const homes = [0, 1, 2, 3, 4].filter(t => t !== cur && w.town.homesByTier[t] && w.town.homesByTier[t].length);
    return `<p>${esc(T('money.cash', { cash: U.fmtMoney(p.cash), inv: U.fmtMoney(P.invValue(w, p)), mc: U.fmtMoney(p.mcost) }))}</p>
      <div class="life-cats">${[0.1, 0.25, 0.5].map(x => `<button data-invest="${x}" ${busy('INVEST') ? 'disabled' : ''}>${esc(T('money.invest'))} ${x * 100}%</button>`).join('')}${[0.25, 0.5, 1].map(x => `<button data-sell="${x}" ${busy('SELL') ? 'disabled' : ''}>${esc(T('money.sell'))} ${x * 100}%</button>`).join('')}</div>
      <p class="note">${esc(T('money.note'))}</p><h4>${esc(T('money.home'))}</h4><p>${esc(T('money.homeNow', { home: C.TIERS.housing[cur].name, rent: U.fmtMoney(Pl.rentOf(w, cur)) }))}</p>
      ${p.isHead ? `<ul class="list-plain life-jobs">${homes.map(t => `<li><span>${esc(C.TIERS.housing[t].name)} <small class="muted">${U.fmtMoney(Pl.rentOf(w, t))}</small></span><button class="ghost small" data-home="${t}" ${busy('MOVE_HOME') ? 'disabled' : ''}>${esc(T('money.move'))}</button></li>`).join('')}</ul>` : `<p class="muted">${esc(T('money.notHead'))}</p>`}`;
  }
  function friendsHtml(w, p) {
    const s = w.player, mine = (s.friends || []).map(f => [w.people[f.id], f.since]).filter(x => x[0]);
    const near = w.living.filter(q => q.alive && q !== p && !q.away && !P.isAdult(w, q) && Math.abs(P.age(w, q) - P.age(w, p)) <= 2 && !mine.some(x => x[0] === q)).slice(0, 5);
    return `${mine.length ? `<ul class="list-plain">${mine.map(([q, d]) => `<li><span>${UI.plink(w, q.id)}</span><small class="muted">${esc(T('friends.since', { date: U.fmtDate(d) }))}</small></li>`).join('')}</ul>` : `<p class="muted">${esc(T('friends.none'))}</p>`}
      ${near.length ? `<h4>${esc(T('friends.suggest'))}</h4><ul class="list-plain">${near.map(q => `<li><span>${UI.plink(w, q.id)} <small class="muted">${Math.floor(P.age(w, q))}</small></span><button class="ghost small" data-friend="${q.id}" ${s.pending.some(c => c.kind === 'MAKE_FRIEND' && c.args.pid === q.id) ? 'disabled' : ''}>${esc(T('friends.ask'))}</button></li>`).join('')}</ul>` : ''}
      <p class="note">${esc(T('friends.note'))}</p>`;
  }
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
    const list = Pl.openings(w, p, true).slice(0, 8), busy = k => s.pending.some(c => c.kind === k);
    const now = p.job ? `<p>${esc(T('work.now', { job: p.job.title, pay: U.fmtMoney(p.job.salary), date: U.fmtDate(p.job.startDay) }))}</p>${Pl.HANDLERS.ASK_RAISE && !p.job.fixedTitle ? `<button class="ghost small" data-raise="1" ${busy('ASK_RAISE') ? 'disabled' : ''}>${esc(T('work.raise'))}</button> <button class="ghost small" data-quit="1" ${busy('QUIT_JOB') ? 'disabled' : ''}>${esc(T('work.quit'))}</button>` : ''}` : '';
    const when = v => { const d = v.closeDay - w.day; return d > 0 ? T('time.inDays', { count: d }) : T('time.today'); };
    return `${now}${apps.length ? `<h4>${esc(T('jobs.yourApps'))}</h4><ul class="list-plain">${apps.map(a => `<li><span>📄 ${esc(a.title)} · ${U.fmtMoney(a.salary)}</span><span class="muted">${esc(T('jobs.decides', { when: a.closeDay > w.day ? T('time.inDays', { count: a.closeDay - w.day }) : T('time.today') }))}</span></li>`).join('')}</ul>` : ''}
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
        <div class="life-cat-body">${UI.lifeCat === 'work' ? workHtml(w, p) : UI.lifeCat === 'care' ? careHtml(w, p) : UI.lifeCat === 'learn' && !P.isAdult(w, p) ? learnHtml(w, p) : UI.lifeCat === 'learn' ? adultLearnHtml(w, p) : UI.lifeCat === 'money' ? moneyHtml(w, p) : UI.lifeCat === 'friends' ? friendsHtml(w, p) : `<p class="muted">${esc(T('cat.soon'))}</p>`}</div></div>`}
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
      else if (b.dataset.effort) say(Pl.request(w, 'SET_EFFORT', { level: b.dataset.effort }));
      else if (b.dataset.club) say(Pl.request(w, 'ASK_CLUB', { club: b.dataset.club }));
      else if (b.dataset.quitclub) say(Pl.request(w, 'QUIT_CLUB', {}));
      else if (b.dataset.allow) say(Pl.request(w, 'ASK_ALLOWANCE', { chores: b.dataset.allow === '1' }));
      else if (b.dataset.friend) say(Pl.request(w, 'MAKE_FRIEND', { pid: Number(b.dataset.friend) }));
      else if (b.dataset.school) say(Pl.request(w, 'ASK_SCHOOL', { tier: b.dataset.school }));
      else if (b.dataset.plan) say(Pl.request(w, 'SET_PLAN', { plan: b.dataset.plan }));
      else if (b.dataset.raise) say(Pl.request(w, 'ASK_RAISE', {}));
      else if (b.dataset.quit) say(Pl.request(w, 'QUIT_JOB', {}));
      else if (b.dataset.enroll) say(Pl.request(w, 'ENROLL', { course: b.dataset.enroll }));
      else if (b.dataset.dropout) say(Pl.request(w, 'DROP_OUT', {}));
      else if (b.dataset.invest) say(Pl.request(w, 'INVEST', { share: Number(b.dataset.invest) }));
      else if (b.dataset.sell) say(Pl.request(w, 'SELL', { share: Number(b.dataset.sell) }));
      else if (b.dataset.home) say(Pl.request(w, 'MOVE_HOME', { tier: Number(b.dataset.home) }));
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
