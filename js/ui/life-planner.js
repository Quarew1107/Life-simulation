// Play a Life, view B: the day planner, a drawer across the bottom of the map (cleaner layout, Nov 2026). One line
// on top: tomorrow's hours, cost and cash after; then tomorrow as an 8-hour bar (one block per planned request,
// sized by its hours, with a cancel cross); then everything you can do: area buttons and a search box, the
// possible requests as cards (time, cost, who decides, chance), and the ones that cannot happen tomorrow folded
// into one "Not possible now" list with the reasons. Who you are and what needs deciding stay in the side panel
// (on a phone, where the panel steps aside, the decisions show here). Same requests and buttons as the hub.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, UI = LES.UI, Pl = LES.Player, esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s); // G: data names in the reader's language (PL-17)
  const $ = id => document.getElementById(id);
  UI.planCat = 'all'; UI.planOpen = true; UI._planSearch = '';
  // Who decides, for requests another person or an institution answers.
  const DECIDER = { ASK_DATE: 'other', ASK_PARTNER: 'other', PROPOSE: 'partner', COUNSEL: 'partner', ASK_RAISE: 'boss', APPLY_JOB: 'employer', ENROLL: 'college', ASK_CARE: 'carer', ASK_CLUB: 'carer', ASK_ALLOWANCE: 'carer', ASK_SCHOOL: 'carer', MAKE_FRIEND: 'other', AFFAIR: 'other', STAND: 'voters', CHOOSE_SCHOOL: 'carer2', DATE_NIGHT: 'partner', MEET_ONLINE: 'other', HANG_OUT: 'other', ASK_HELP: 'other', INTRODUCE: 'other', CONFESS: 'partner', PROPOSE_LAW: 'council', MEET_OFFICIAL: 'other' };

  // Everything this person could ask for now, by area (the same button attributes as the hub's pages).
  function catalogue(w, p) {
    const out = [], s = w.player, add = (cat, attr, val, kind, args, extra) => out.push(Object.assign({ cat, attr, val: String(val), kind, args }, extra || {}));
    const adult = P.isAdult(w, p);
    if (adult) {
      if (p.job && !p.job.fixedTitle) { add('work', 'raise', 1, 'ASK_RAISE', {}); add('work', 'quit', 1, 'QUIT_JOB', {}); }
      for (const v of Pl.openings(w, p).slice(0, 5)) add('work', 'apply', v.id, 'APPLY_JOB', { vac: v.id }, { note: U.fmtMoney(v.salary) });
      if (Pl.bizTypes && p.manages < 0) for (const t of Pl.bizTypes(w, p).filter(x => x.ok).slice(0, 3)) add('work', 'startbiz', t.id, 'START_BIZ', { type: t.id }, { note: U.fmtMoney(t.capital) });
      if (P.age(w, p) >= 55 && !p.retired) add('work', 'retire', 1, 'RETIRE', {});
      for (const x of [0.1, 0.25, 0.5]) add('money', 'invest', x, 'INVEST', { share: x });
      for (const x of [0.25, 1]) add('money', 'sell', x, 'SELL', { share: x });
      if (Pl.ticket && !s.noLottery) add('money', 'ticket', 1, 'BUY_TICKET', {});
      if (p.isHead) for (const t of [0, 1, 2, 3, 4]) if (t !== p.tiers.housing && w.town.homesByTier[t] && w.town.homesByTier[t].length) add('money', 'home', t, 'MOVE_HOME', { tier: t }, { note: U.fmtMoney(Pl.rentOf(w, t)) });
      const q = p.partnerId !== null ? w.people[p.partnerId] : null;
      if (q && q.alive) { add('love', 'datenight', 1, 'DATE_NIGHT', {}); if (!(s.married && s.married.pid === q.id)) { add('love', 'propose', 'civil', 'PROPOSE', { kind: 'civil' }); add('love', 'propose', 'wedding', 'PROPOSE', { kind: 'wedding' }); } add('love', 'counsel', 1, 'COUNSEL', {}); for (const k of ['yes', 'later']) add('love', 'baby', k, 'BABY_WISH', { wish: k }); }
      else { if (s.dating && w.people[s.dating.pid]) add('love', 'partner', s.dating.pid, 'ASK_PARTNER', { pid: s.dating.pid }); if (Pl.singles) for (const x of Pl.singles(w, p, 3)) add('love', 'date', x.id, 'ASK_DATE', { pid: x.id }); }
      for (const c of p.careOf.map(id => w.people[id]).filter(c => c.alive && !P.isAdult(w, c))) add('love', 'carekid', c.id, 'CARE_CHILD', { pid: c.id });
      for (const f of p.parents.concat(p.children).map(id => w.people[id]).filter(x => x.alive && !x.away && P.isAdult(w, x))) { add('love', 'visit', f.id, 'VISIT', { pid: f.id }); add('love', 'gift', f.id, 'GIFT', { pid: f.id, share: 0.1 }); }
      add('health', 'doctor', 1, 'SEE_DOCTOR', {}); add('health', 'counselling', 1, 'COUNSELLING', {}); add('health', 'rest', 1, 'REST', {});
      for (const k of ['light', 'regular']) if (s.exercise !== k) add('health', 'exercise', k, 'SET_EXERCISE', { level: k });
      for (const k of Object.keys(Pl.TRIPS || {})) add('health', 'travel', k, 'TRAVEL', { kind: k }, { note: T('health.days', { count: Pl.TRIPS[k].days }) });
      if (Pl.courses && !p.enrol) for (const c of Pl.courses(w, p).slice(0, 5)) add('learn', 'enroll', c.id, 'ENROLL', { course: c.id }, { odds: c.chance });
      add('community', 'volunteer', 1, 'VOLUNTEER', {});
      const amt = Math.max(w.px(20), Math.round(0.02 * Pl.typicalPay(w)));
      add('community', 'donate', amt, 'DONATE', { amt });
      if (w.gov && LES.Gov && !LES.Gov.appointed() && !s.stand) add('community', 'stand', 1, 'STAND', {});
      for (const x of (Pl.friendList ? Pl.friendList(w) : []).slice(0, 4)) { add('friends', 'hang', x.q.id, 'HANG_OUT', { pid: x.q.id }); add('friends', 'helpfr', x.q.id, 'HELP_FRIEND', { pid: x.q.id }); }
      if (Pl.nearby) { const n = Pl.nearby(w, p); for (const q of n.work.concat(n.home).slice(0, 3)) add('friends', 'friend', q.id, 'MAKE_FRIEND', { pid: q.id }); }
      add('friends', 'online', 1, 'MEET_ONLINE', {});
      for (const q2 of w.living.filter(x => x.alive && !x.away && x.migrant && P.isAdult(w, x) && x.arrivedDay !== null && x.arrivedDay > w.day - 90).slice(0, 3)) add('community', 'welcome', q2.id, 'WELCOME', { pid: q2.id });
    } else {
      if (Pl.carerOf(w, p)) add('care', 'care', 1, 'ASK_CARE', {});
      if (P.age(w, p) >= 6) for (const k of ['relaxed', 'steady', 'hard']) if ((s.effort || 'steady') !== k) add('learn', 'effort', k, 'SET_EFFORT', { level: k });
      if (Pl.CLUBS && !s.club && P.age(w, p) >= 4) for (const k of Object.keys(Pl.CLUBS)) add('learn', 'club', k, 'ASK_CLUB', { club: k });
      if (P.age(w, p) >= 7 && Pl.schoolOffers) for (const o of Pl.schoolOffers(w, p)) if (o.why !== 'none' && o.tier !== Pl.currentTier(w, p)) add('learn', 'school', o.tier, 'ASK_SCHOOL', { tier: o.tier }, { note: o.fee ? U.fmtMoney(o.fee) : '' });
      for (const q of w.living.filter(x => x.alive && x !== p && !x.away && !P.isAdult(w, x) && Math.abs(P.age(w, x) - P.age(w, p)) <= 2 && !(s.friends || []).some(f => f.id === x.id)).slice(0, 4)) add('friends', 'friend', q.id, 'MAKE_FRIEND', { pid: q.id });
      for (const x of (Pl.friendList ? Pl.friendList(w) : []).slice(0, 3)) add('friends', 'hang', x.q.id, 'HANG_OUT', { pid: x.q.id });
      if (P.age(w, p) >= 13) add('friends', 'online', 1, 'MEET_ONLINE', {});
    }
    for (const it of out) {
      it.label = LES.I18n.render(Pl.describe(w, { kind: it.kind, args: it.args }));
      it.hours = (Pl.HANDLERS[it.kind] || {}).hours || 0;
      it.cost = Pl.costOf(w, p, it.kind, it.args);
      it.check = Pl.check(w, it.kind, it.args);
    }
    return out;
  }

  function root() {
    let el = $('life-planner');
    if (el) return el;
    const wrap = $('map-wrap');
    if (!wrap) return null;
    el = document.createElement('div');
    el.id = 'life-planner'; el.className = 'life-planner hidden';
    wrap.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.fold !== undefined) { UI.planOpen = !UI.planOpen; UI._planHtml = null; UI.renderPlanner(); return; }
      if (b.dataset.pcat !== undefined) { UI.planCat = b.dataset.pcat; UI._planHtml = null; UI.renderPlanner(); return; }
      if (b.dataset.clear !== undefined) { const w = UI._life.where(); if (w) for (const c of w.player.pending.slice()) Pl.cancel(w, c.id); UI._planHtml = null; UI._lifeHtml = null; UI.update(true); return; }
      UI._life.onLifeClick(e, el);
      UI._planHtml = null;
    });
    el.addEventListener('input', e => { // the search box filters the list in place (typing stays smooth)
      if (e.target.id !== 'plan-search') return;
      UI._planSearch = e.target.value;
      filter(el);
    });
    return el;
  }
  function filter(el) {
    const t = (UI._planSearch || '').trim().toLowerCase();
    for (const li of el.querySelectorAll('.plan-act')) li.classList.toggle('hidden', !!t && !li.dataset.text.includes(t));
  }

  function timelineHtml(w, p) {
    const L = UI._life, s = w.player, list = s.pending || [];
    let x = 0;
    const blocks = list.map(c => {
      const h = (Pl.HANDLERS[c.kind] || {}).hours || 0, left = x / Pl.DAY_HOURS * 100, width = Math.max(h, 0.6) / Pl.DAY_HOURS * 100; x += h;
      const d = DECIDER[c.kind];
      return `<div class="plan-blk g-${L.groupOf(c.kind)}" style="left:${Math.min(left, 96)}%;width:calc(${Math.min(width, 100 - Math.min(left, 96))}% - 4px)" title="${esc(LES.I18n.render(Pl.describe(w, c)))}"><button class="x" data-cancel="${esc(c.id)}" aria-label="${esc(T('queue.cancel'))}">✕</button><b>${L.ICON[L.groupOf(c.kind)] || ''} ${esc(LES.I18n.render(Pl.describe(w, c)))}</b><small>${esc(T('queue.hours', { count: h }))}${d ? ` · ${esc(T(`plan.who.${d}`))}` : ''}</small></div>`;
    }).join('');
    const hrs = x, cost = list.reduce((t, c) => t + Pl.costOf(w, p, c.kind, c.args), 0);
    const free = Math.max(0, Pl.DAY_HOURS - hrs);
    const head = `<div class="plan-head"><h3>${esc(T('plan.tomorrow', { date: U.fmtDate(w.day + 1) }))}</h3>
      <span class="plan-meta"><b class="${hrs > Pl.DAY_HOURS ? 'neg' : ''}">${esc(T('tomorrow.used', { hours: hrs, max: Pl.DAY_HOURS }))}</b> · ${cost ? `<b class="neg">−${U.fmtMoney(cost)}</b> · ` : ''}${esc(T('plan.cashAfter', { cash: U.fmtMoney(p.cash - cost) }))}</span>
      ${list.length ? `<button class="ghost small" data-clear="1">${esc(T('plan.clear'))}</button>` : ''}<button class="ghost small plan-fold" data-fold="1" aria-label="${esc(T('plan.drawer', { name: L.name1(p) }))}">▾</button></div>`;
    const rest = free > 0 ? `<div class="plan-free" style="left:${Math.min(hrs / Pl.DAY_HOURS * 100, 100)}%;width:${free / Pl.DAY_HOURS * 100}%" title="${esc(T('plan.routine', { name: L.name1(p) }))}">${esc(T('plan.freeHours', { count: free }))}</div>` : '';
    return `<div class="plan-mid">${head}<div class="plan-track">${blocks}${blocks ? rest : ''}${blocks ? '' : `<div class="plan-empty muted">${esc(T('tomorrow.empty', { name: L.name1(p) }))}</div>`}</div></div>`;
  }
  function pickerHtml(w, p) {
    const L = UI._life, items = catalogue(w, p), cats = ['all'].concat(L.catsFor(Pl.stageOf(Math.floor(P.age(w, p))))).filter(k => k === 'all' || items.some(i => i.cat === k));
    if (!cats.includes(UI.planCat)) UI.planCat = 'all';
    const shown = items.filter(i => UI.planCat === 'all' || i.cat === UI.planCat), can = shown.filter(i => i.check.ok), cannot = shown.filter(i => !i.check.ok);
    const card = i => { const d = DECIDER[i.kind], why = i.check.ok ? '' : LES.I18n.render(Pl.whyNot(w, i.kind, i.args, i.check));
      return `<li class="plan-act ${i.check.ok ? '' : 'off'}" data-text="${esc(i.label.toLowerCase())}"><div><b>${L.ICON[L.groupOf(i.kind)] || ''} ${esc(G(i.label))}</b><div class="plan-tags"><span>⏱ ${esc(T('queue.hours', { count: i.hours }))}</span>${i.cost ? `<span class="c">${U.fmtMoney(i.cost)}</span>` : ''}${i.note ? `<span>${esc(G(i.note))}</span>` : ''}${i.odds !== undefined ? `<span class="o">${esc(T('learn.chance', { pct: Math.round(i.odds * 100) }))}</span>` : ''}${d ? `<span class="o">${esc(T(`plan.who.${d}`))}</span>` : ''}</div>${why ? `<small class="neg">${esc(why)}</small>` : ''}</div>${i.check.ok ? `<button class="ghost small teal" data-${i.attr}="${esc(i.val)}" aria-label="${esc(T('plan.addBtn'))}: ${esc(G(i.label))}">＋</button>` : ''}</li>`; };
    return `<div class="plan-right"><div class="plan-filter"><span class="plan-add">${esc(T('plan.add'))} <small class="muted">${esc(T('plan.count', { count: items.filter(i => i.check.ok).length }))}</small></span>
      <div class="life-cats">${cats.map(k => `<button class="${UI.planCat === k ? 'on' : ''}" data-pcat="${k}">${k === 'all' ? esc(T('plan.all')) : `${L.ICON[k]} ${esc(T(`cat.${k}`))}`}</button>`).join('')}</div>
      <input id="plan-search" type="search" class="plan-search" placeholder="${esc(T('plan.search'))}" value="${esc(UI._planSearch || '')}" autocomplete="off"></div>
      <ul class="list-plain plan-list">${can.map(card).join('')}</ul>
      ${cannot.length ? `<details class="plan-notnow" ${L.keep('plan-notnow')}><summary>${esc(T('plan.notNow', { count: cannot.length }))}</summary><ul class="list-plain plan-list">${cannot.map(card).join('')}</ul></details>` : ''}</div>`;
  }

  UI.renderPlanner = function () {
    const app = UI.app, w = UI._life && UI._life.where(), el = root();
    if (!el) return;
    const on = UI.lifeView === 'B' && !!w && !w.player.waiting && app.view !== 'region';
    const p = on ? Pl.person(w) : null;
    if (!on || !p || w.player.ended) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); el.classList.toggle('folded', !UI.planOpen);
    if (UI._life.busyWith(el)) return;
    const L = UI._life, decide = L.decisionsHtml(w, p);
    const html = `<button class="plan-grip" data-fold="1">${UI.planOpen ? '▾' : '▴'} ${esc(T('plan.drawer', { name: L.name1(p) }))}</button>${UI.planOpen ? `<div class="plan-cols">${decide ? `<div class="plan-decide">${decide}</div>` : ''}${timelineHtml(w, p)}${pickerHtml(w, p)}</div>` : ''}`;
    if (html === UI._planHtml && el.firstElementChild) return;
    el.innerHTML = html; UI._planHtml = html;
    filter(el);
  };
})(globalThis.LES = globalThis.LES || {});
