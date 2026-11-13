// Play a Life, view C: the life story. It covers the map with the played person's life: who they are and the
// people who matter, the decision waiting now, tomorrow's plan, and their story so far grouped by age. Two big
// buttons: "Live on until something happens" (Story speed; the clock stops at the next important decision or
// big moment by itself) and "+ Do something" (suggested actions first, then each area of life). A small plan of
// the town in the corner returns to the map. The side panel keeps the hub (view A) and the town's other tabs.
// Everything goes through the same requests and buttons as the hub (UI._life).
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, UI = LES.UI, Pl = LES.Player, esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p);
  const $ = id => document.getElementById(id);
  const STORY_SPEED = 4; // the "Story" entry of the speed bar (5 days a second)
  UI.storySheet = null;  // the "Do something" sheet: null (closed), 'suggested' or an area

  const KIND_ICON = { moment: '✨', event: '·', choice: '✔️', auto: '🧠', cmd: '•', result: '📄', life: '⭐', pass: '…' };
  const MOMENT_ICON = { born: '👶', school: '🎒', schoolDone: '🎓', graduated: '🎓', firstJob: '💼', newJob: '💼', promoted: '📈', together: '🏠', married: '💍', child: '👶', grandchild: '👶', business: '🏪', elected: '🏛️', retired: '🌅', lost: '🕯️', jackpot: '🎉', birthday: '🎂', home: '🏡' };

  function root() {
    let el = $('life-story');
    if (el) return el;
    const wrap = $('map-wrap');
    if (!wrap) return null;
    el = document.createElement('div');
    el.id = 'life-story'; el.className = 'life-story hidden';
    el.setAttribute('aria-label', 'My life story');
    wrap.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('button,canvas');
      if (!b) return;
      if (b.dataset.town !== undefined) { UI.storyHidden = true; UI._storyHtml = null; UI.renderStory(); return; }
      if (b.dataset.liveon !== undefined) { if (!(UI.lifeBlocked && UI.lifeBlocked())) UI.app.setSpeed(STORY_SPEED); return; }
      if (b.dataset.sheet !== undefined) { UI.storySheet = b.dataset.sheet === 'close' || UI.storySheet === b.dataset.sheet && b.dataset.toggle ? null : b.dataset.sheet; UI._storyHtml = null; UI.renderStory(); return; }
      if (b.dataset.person !== undefined) { UI.app.select(Number(b.dataset.person), true); return; }
      UI._life.onLifeClick(e, el);
    });
    el.addEventListener('input', e => { if (e.target.id && e.target.id.startsWith('stk-')) UI._lifeInputs[e.target.id] = e.target.value; });
    return el;
  }
  // The button to come back to the story from the map.
  function backButton(show, name) {
    let b = $('life-story-back');
    const wrap = $('map-wrap');
    if (!b && wrap) {
      b = document.createElement('button'); b.id = 'life-story-back'; b.className = 'life-story-back';
      b.onclick = () => { UI.storyHidden = false; UI._storyHtml = null; UI.renderStory(); };
      wrap.appendChild(b);
    }
    if (!b) return;
    b.classList.toggle('hidden', !show);
    b.textContent = `📖 ${T('story.back', { name })}`;
  }

  // The people who matter: partner, children, parents, grandchildren (real portraits; click to see them).
  function familyHtml(w, p) {
    const L = UI._life, rel = [];
    if (p.partnerId !== null && w.people[p.partnerId].alive) rel.push([w.people[p.partnerId], T(w.player.married && w.player.married.pid === p.partnerId ? 'story.spouse' : 'story.partner')]);
    for (const id of p.children) if (w.people[id].alive) rel.push([w.people[id], T('story.child', { age: Math.floor(P.age(w, w.people[id])) })]);
    for (const id of p.parents) if (w.people[id].alive) rel.push([w.people[id], T('story.parent')]);
    for (const id of p.children.flatMap(c => w.people[c].children)) if (w.people[id].alive) rel.push([w.people[id], T('story.grandchild')]);
    if (!rel.length) return `<p class="muted small">${esc(T('story.noFamily'))}</p>`;
    return `<div class="story-family">${rel.slice(0, 9).map(([q, r]) => `<button class="story-kin" data-person="${q.id}" title="${esc(P.name(q))}"><canvas data-pid="${q.id}" width="40" height="52"></canvas><span>${esc(L.name1(q))}</span><small>${esc(r)}</small></button>`).join('')}</div>`;
  }

  // The story so far (this life), newest first, by age; birthdays head each year with its review.
  function storyHtml(w, p) {
    const s = w.player, start = s.since || 0;
    const lines = s.journal.filter(e => e.day >= start && e.kind !== 'cmd' || (e.kind === 'cmd' && e.day >= start && e.code !== 'ok' && e.code !== 'cancelled')).slice(-140).reverse();
    let out = '', age = null;
    for (const e of lines) {
      const a = Math.floor((e.day - p.birthDay) / 365);
      if (a !== age) { age = a; out += `<div class="story-year">${esc(T('story.age', { age: a }))}</div>`; }
      const ic = e.kind === 'moment' ? MOMENT_ICON[e.moment] || '✨' : KIND_ICON[e.kind] || '•';
      out += `<div class="story-line ${e.imp >= 2 || e.kind === 'moment' ? 'big' : ''}"><span class="ic">${ic}</span><span>${esc(LES.I18n.render(e))}</span><small>${U.fmtDate(e.day)}</small></div>`;
    }
    const earlier = s.chain.length > 1 ? `<p class="muted small">${esc(T('story.earlier', { count: s.chain.length - 1 }))}</p>` : '';
    return out ? out + earlier : `<p class="muted">${esc(T('story.empty'))}</p>`;
  }

  // Suggested things to do now (each a real request that can happen tomorrow), from the person's situation.
  function suggestions(w, p) {
    const out = [], add = (attr, val, kind, args) => { if (Pl.check(w, kind, args).ok) out.push({ attr, val, label: LES.I18n.render(Pl.describe(w, { kind, args })), group: UI._life.groupOf(kind) }); };
    if (p.stress > 55) add('rest', 1, 'REST', {});
    if (p.health < 75) add('doctor', 1, 'SEE_DOCTOR', {});
    if (P.isAdult(w, p)) {
      if (p.job) add('raise', 1, 'ASK_RAISE', {});
      else if (!p.retired) { const v = Pl.openings(w, p)[0]; if (v) add('apply', v.id, 'APPLY_JOB', { vac: v.id }); }
      const par = p.parents.map(id => w.people[id]).find(q => q.alive && !q.away); if (par) add('visit', par.id, 'VISIT', { pid: par.id });
      const kid = p.careOf.map(id => w.people[id]).find(c => c.alive && !P.isAdult(w, c)); if (kid) add('carekid', kid.id, 'CARE_CHILD', { pid: kid.id });
      if (p.partnerId === null && Pl.singles) { const q = Pl.singles(w, p, 1)[0]; if (q) add('date', q.id, 'ASK_DATE', { pid: q.id }); }
      if (Pl.courses && !p.enrol) { const c = Pl.courses(w, p).find(x => x.chance > 0.5); if (c) add('enroll', c.id, 'ENROLL', { course: c.id }); }
      if (p.cash > 8 * p.mcost) add('travel', 'domestic', 'TRAVEL', { kind: 'domestic' });
      add('volunteer', 1, 'VOLUNTEER', {});
    } else {
      const g = Pl.carerOf(w, p); if (g) add('care', 1, 'ASK_CARE', {});
      if (Pl.CLUBS && !w.player.club && P.age(w, p) >= 4) add('club', 'sport', 'ASK_CLUB', { club: 'sport' });
    }
    return out.slice(0, 6);
  }
  function sheetHtml(w, p) {
    const L = UI._life, cats = L.catsFor(Pl.stageOf(Math.floor(P.age(w, p)))), cur = UI.storySheet;
    const tabs = [['suggested', '⭐']].concat(cats.map(k => [k, L.ICON[k]])).map(([k, ic]) => `<button class="${cur === k ? 'on' : ''}" data-sheet="${k}">${ic} ${esc(k === 'suggested' ? T('story.suggested') : T(`cat.${k}`))}</button>`).join('');
    let body;
    if (cur === 'suggested') {
      const sug = suggestions(w, p);
      body = sug.length ? `<div class="story-sugs">${sug.map(x => `<button class="story-sug g-${x.group}-l" data-${x.attr}="${esc(String(x.val))}">${L.ICON[x.group] || ''} ${esc(x.label)}</button>`).join('')}</div>` : `<p class="muted">${esc(T('story.noSuggest'))}</p>`;
    } else body = `<div class="life-cat-body">${L.pageHtml(w, p, cur)}</div>`;
    return `<div class="story-sheet" role="dialog" aria-label="${esc(T('story.do'))}"><div class="story-sheet-head"><b>＋ ${esc(T('story.do'))}</b><button class="ghost small" data-sheet="close">✕</button></div><div class="life-cats">${tabs}</div>${body}</div>`;
  }

  UI.renderStory = function () {
    const app = UI.app, w = UI._life && UI._life.where(), el = root();
    if (!el) return;
    const on = UI.lifeView === 'C' && !!w && !w.player.waiting && app.view !== 'region';
    const p = on ? Pl.person(w) : null;
    backButton(on && UI.storyHidden, p ? UI._life.name1(p) : '');
    if (!on || UI.storyHidden || !p) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (UI._life.busyWith(el)) return;
    const L = UI._life, s = w.player, sm = Pl.summary(w);
    for (const d of el.querySelectorAll('details[data-keep]')) { if (d.open) UI._lifeOpen.add(d.dataset.keep); else UI._lifeOpen.delete(d.dataset.keep); }
    const goal = p.goal && LES.Goals ? LES.Goals.DEFS[p.goal.id] : null, prog = goal && goal.progress ? U.clamp(goal.progress(w, p, p.goal), 0, 1) : 0;
    const left = `<div class="story-left">
        <div class="story-me"><canvas id="story-portrait" width="96" height="128" aria-hidden="true"></canvas><div><div class="life-name">${esc(sm.name)}</div><div class="muted">${esc(T('life.ageStage', { age: sm.age, stage: T(`life.${sm.stage}`) }))}</div><div>${esc(L.status(w, p))}</div>${p.alive ? `<div class="life-mood">“${esc(LES.I18n.render(Pl.mood(w, p)))}”</div>` : ''}</div></div>
        ${p.alive ? `<div class="life-rings story-rings">${L.ring(p.health, T('life.health'), 'var(--green)')}${L.ring(p.happy, T('life.happy'), 'var(--teal)')}${L.ring(p.stress, T('life.stress'), 'var(--red)')}${L.ring(p.energy, T('story.energy'), 'var(--blue)')}</div>` : ''}
        <div class="card"><h3>${esc(T('story.people'))}</h3>${familyHtml(w, p)}</div>
        ${P.isAdult(w, p) || p.nw > 0 ? `<div class="card"><h3>${esc(T('cat.money'))}</h3><div class="story-kv"><span>${esc(T('life.cash'))}</span><b class="gold">${U.fmtMoney(p.cash)}</b></div><div class="story-kv"><span>${esc(T('story.invested'))}</span><b>${U.fmtMoney(P.invValue(w, p))}</b></div><div class="story-kv"><span>${esc(T('story.monthly'))}</span><b class="${p.incomeEMA - p.mcost >= 0 ? 'pos' : 'neg'}">${U.fmtMoney(Math.round(p.incomeEMA - p.mcost))}</b></div></div>` : ''}
        ${goal ? `<div class="card"><h3>${esc(T('story.goal'))}</h3><div>${goal.icon} ${esc(LES.Goals.text(p.goal))}</div><span class="life-goalbar wide"><i style="width:${Math.round(prog * 100)}%"></i></span></div>` : ''}
        <button class="story-townbtn" data-town="1" title="${esc(T('story.town'))}"><canvas class="story-pip" id="story-pip"></canvas><span>🗺 ${esc(T('story.town'))}</span></button>
      </div>`;
    const main = s.ended ? `<div class="story-main">${L.successionHtml(w)}</div>`
      : `<div class="story-main"><div class="story-now">${L.decisionsHtml(w, p) || `<div class="card muted">${esc(T('story.calm', { name: L.name1(p) }))}</div>`}${L.tomorrowHtml(w, p)}</div>
        <h3 class="story-title">${esc(T('story.title', { name: L.name1(p) }))}</h3><div class="story-lines">${storyHtml(w, p)}</div></div>`;
    const dock = s.ended ? '' : `<div class="story-dock"><button class="primary big" data-liveon="1" title="${esc(T('story.dockNote'))}">▶ ${esc(T('story.liveOn'))}</button><button class="ghost big teal" data-sheet="suggested" data-toggle="1">＋ ${esc(T('story.do'))}</button></div>`;
    const html = `<div class="story-top"><b>📖 ${esc(T('story.heading', { name: sm.name }))}</b><button class="ghost small" data-town="1">🗺 ${esc(T('story.town'))}</button></div>
      <div class="story-body">${left}${main}</div>
      ${UI.storySheet && !s.ended ? sheetHtml(w, p) : ''}${dock}`;
    if (html === UI._storyHtml && el.firstElementChild) return;
    el.innerHTML = html; UI._storyHtml = html;
    L.portrait($('story-portrait'), w, p);
    for (const c of el.querySelectorAll('canvas[data-pid]')) L.portrait(c, w, w.people[Number(c.dataset.pid)]);
    if (s.ended) L.portrait(el.querySelector('#life-remember-pic'), w, w.people[s.ended.id]);
    const pip = el.querySelector('#story-pip');
    if (pip && LES.RegionMap && LES.RegionMap.drawTown) {
      const t = w.town, S = 2; pip.width = t.W * S; pip.height = t.H * S;
      try { LES.RegionMap.drawTown(pip.getContext('2d'), t, S); } catch (e) { /* plan not ready */ }
    }
    if (p.alive && !s.ended) L.markAvailability(el, w);
  };
})(globalThis.LES = globalThis.LES || {});
