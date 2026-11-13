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
  UI._lifeOpen = new Set();   // folded sections the player has opened (kept open across redraws)
  UI._lifeInputs = {};        // what the player typed in number boxes (kept across redraws)
  const keep = k => `data-keep="${k}" ${UI._lifeOpen.has(k) ? 'open' : ''}`;
  const typed = (id, d) => (UI._lifeInputs[id] !== undefined ? UI._lifeInputs[id] : d);

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
  // Shares: pick a company (or the index fund) and how many shares; bought or sold at tomorrow's price.
  function sharesHtml(w, p) {
    if (!Pl.market) return '';
    const s = w.player, busy = (k, tk) => s.pending.some(c => c.kind === k && c.args.tk === tk), pct = r => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`;
    const name = n => (typeof n === 'object' ? T(n.key) : n), own = x => (x >= 100 ? Math.round(x).toLocaleString() : (Math.round(x * 100) / 100).toString());
    return `<details class="life-more" ${keep('shares')}><summary>${esc(T('money.shares'))}</summary><ul class="list-plain life-stocks">${Pl.market(w, p).map(m => `<li>
        <div class="life-stock-head"><b>${esc(name(m.name))}</b> <small class="muted">${m.tk === 'idx' ? '' : esc(m.tk)}${m.sector ? ` · ${esc(m.sector)}` : ''}</small><span>${U.fmtPrice(m.price)} <small class="${m.ret >= 0 ? 'up' : 'down'}">${pct(m.ret)}</small></span></div>
        <div class="life-stock-row"><small class="muted">${m.held > 0 ? esc(T('money.own', { shares: own(m.held), value: U.fmtMoney(m.held * m.price) })) : esc(T('money.ownNone'))}</small>
          <span><input type="number" min="1" step="1" id="stk-${m.tk}" value="${esc(String(typed(`stk-${m.tk}`, m.tk === 'idx' ? 100 : 10)))}" aria-label="${esc(T('money.qty'))}"><button class="ghost small" data-buystock="${m.tk}" ${busy('BUY_STOCK', m.tk) ? 'disabled' : ''}>${esc(T('money.buy'))}</button><button class="ghost small" data-sellstock="${m.tk}" ${m.held > 0 && !busy('SELL_STOCK', m.tk) ? '' : 'disabled'}>${esc(T('money.sell'))}</button>${m.held > 0 ? `<button class="link" data-sellall="${m.tk}" ${busy('SELL_STOCK', m.tk) ? 'disabled' : ''}>${esc(T('money.sellAll'))}</button>` : ''}</span></div></li>`).join('')}</ul>
      <p class="note">${esc(T('money.sharesNote'))}</p></details>`;
  }
  // Adults: cash, the index fund, and the home.
  function moneyHtml(w, p) {
    const s = w.player, C = LES.C, busy = k => s.pending.some(c => c.kind === k), cur = p.tiers.housing;
    const homes = [0, 1, 2, 3, 4].filter(t => t !== cur && w.town.homesByTier[t] && w.town.homesByTier[t].length);
    return `<p>${esc(T('money.cash', { cash: U.fmtMoney(p.cash), inv: U.fmtMoney(P.invValue(w, p)), mc: U.fmtMoney(p.mcost) }))}</p>
      <div class="life-cats">${[0.1, 0.25, 0.5].map(x => `<button data-invest="${x}" ${busy('INVEST') ? 'disabled' : ''}>${esc(T('money.invest'))} ${x * 100}%</button>`).join('')}${[0.25, 0.5, 1].map(x => `<button data-sell="${x}" ${busy('SELL') ? 'disabled' : ''}>${esc(T('money.sell'))} ${x * 100}%</button>`).join('')}</div>
      <p class="note">${esc(T('money.note'))}</p>${sharesHtml(w, p)}${Pl.ticket && !s.noLottery ? `<h4>${esc(T('lotto.title'))}</h4><p class="muted">${esc(T('lotto.odds', { price: U.fmtMoney(Pl.ticket(w)), small: U.fmtMoney(Pl.ticket(w) * 2), medium: U.fmtMoney(Pl.ticket(w) * 10), jackpot: U.fmtMoney(Pl.ticket(w) * 10000) }))}</p>${s.lotto ? `<p class="muted">${esc(T('lotto.record', { tickets: s.lotto.tickets, spent: U.fmtMoney(s.lotto.spent), won: U.fmtMoney(s.lotto.won) }))}</p>` : ''}<button class="ghost small" data-ticket="1" ${busy('BUY_TICKET') ? 'disabled' : ''}>${esc(T('lotto.buy'))}</button>` : ''}<h4>${esc(T('money.home'))}</h4><p>${esc(T('money.homeNow', { home: C.TIERS.housing[cur].name, rent: U.fmtMoney(Pl.rentOf(w, cur)) }))}</p>
      ${p.isHead ? `<ul class="list-plain life-jobs">${homes.map(t => `<li><span>${esc(C.TIERS.housing[t].name)} <small class="muted">${U.fmtMoney(Pl.rentOf(w, t))}</small></span><button class="ghost small" data-home="${t}" ${busy('MOVE_HOME') ? 'disabled' : ''}>${esc(T('money.move'))}</button></li>`).join('')}</ul>` : `<p class="muted">${esc(T('money.notHead'))}</p>`}`;
  }
  // Adults: partner or dating, marriage, children, parents (every other person decides for themself).
  function loveHtml(w, p) {
    const s = w.player, busy = (k, pid) => s.pending.some(c => c.kind === k && (pid === undefined || c.args.pid === pid)), q = p.partnerId !== null ? w.people[p.partnerId] : null, M = Pl.typicalPay(w);
    const btn = (attr, label, dis) => `<button class="ghost small" ${attr} ${dis ? 'disabled' : ''}>${esc(label)}</button>`;
    let h = '';
    if (q && q.alive) {
      const married = s.married && s.married.pid === q.id;
      h += `<p>${esc(T(married ? 'love.married' : 'love.partner', { other: P.name(q) }))} ${UI.plink(w, q.id)}</p><div class="life-cats">${married ? '' : btn('data-propose="wedding"', T('love.wedding', { cost: U.fmtMoney(Math.round(1.5 * M)) }), busy('PROPOSE')) + btn('data-propose="civil"', T('love.civil', { cost: U.fmtMoney(Math.round(0.5 * M)) }), busy('PROPOSE'))}${btn('data-counsel="1"', T('love.counsel'), busy('COUNSEL'))}${btn('data-separate="1"', T('love.separate'), busy('SEPARATE'))}</div>`;
      h += `<h4>${esc(T('love.babyTitle'))}</h4><div class="life-cats" role="group">${['auto', 'yes', 'later', 'no'].map(k => `<button class="${(s.babyWish || 'auto') === k ? 'on' : ''}" data-baby="${k}" aria-pressed="${(s.babyWish || 'auto') === k}">${esc(T(`baby.${k}`))}</button>`).join('')}</div>`;
      if (s.affair) { const a = w.people[s.affair.pid]; h += `<p class="muted">${esc(T('love.affair', { other: a ? P.name(a) : '' }))}</p>${btn('data-endaffair="1"', T('love.endAffair'), busy('END_AFFAIR'))}`; }
    } else {
      const d = s.dating && w.people[s.dating.pid];
      h += `<p>${esc(T('love.single'))}</p>`;
      if (d) h += `<p>${esc(T('love.dating', { other: P.name(d), count: s.dating.dates }))}</p>${btn(`data-partner="${d.id}"`, T('love.moveIn'), busy('ASK_PARTNER') || s.dating.dates < 3)}`;
      const list = Pl.singles(w, p, 5);
      h += `<h4>${esc(T('love.meet'))}</h4>${list.length ? `<ul class="list-plain">${list.map(x => `<li><span>${UI.plink(w, x.id)} <small class="muted">${Math.floor(P.age(w, x))}</small></span>${btn(`data-date="${x.id}"`, T('love.ask', { cost: U.fmtMoney(Math.round(0.05 * M)) }), busy('ASK_DATE', x.id))}</li>`).join('')}</ul>` : `<p class="muted">—</p>`}`;
    }
    const kids = p.careOf.map(id => w.people[id]).filter(c => c && c.alive && !P.isAdult(w, c));
    if (kids.length) h += `<h4>${esc(T('love.kids'))}</h4><ul class="list-plain life-jobs">${kids.map(c => { const age = Math.floor(P.age(w, c)), tier = Pl.kidTier(w, c); return `<li><span>${UI.plink(w, c.id)} <small class="muted">${age}${age >= 7 ? ` · ${esc(T(`school.${tier}`))}` : ''}</small></span><span>${btn(`data-carekid="${c.id}"`, T('love.time'), busy('CARE_CHILD', c.id))}${age >= 7 ? `<select data-kidschool="${c.id}" aria-label="${esc(T('learn.school'))}"><option value="">${esc(T('love.school'))}</option>${Pl.schoolOffers(w, c).filter(o => o.why !== 'none' && o.tier !== tier).map(o => `<option value="${o.tier}" ${o.ok ? '' : 'disabled'}>${esc(T(`school.${o.tier}`))}${o.fee ? ` · ${U.fmtMoney(o.fee)}` : ''}</option>`).join('')}</select>` : ''}</span></li>`; }).join('')}</ul>`;
    const fam = p.parents.concat(p.children).map(id => w.people[id]).filter(x => x && x.alive && !x.away && P.isAdult(w, x));
    if (fam.length) h += `<h4>${esc(T('love.family'))}</h4><ul class="list-plain">${fam.map(x => `<li><span>${UI.plink(w, x.id)} <small class="muted">${Math.floor(P.age(w, x))}</small></span><span>${btn(`data-visit="${x.id}"`, T('love.visit'), busy('VISIT', x.id))}${btn(`data-gift="${x.id}"`, T('love.gift'), busy('GIFT', x.id))}</span></li>`).join('')}</ul>`;
    return `${h}<p class="note">${esc(T('love.note'))}</p>`;
  }
  // Adults and seniors: health, rest, exercise and trips.
  function healthHtml(w, p) {
    const s = w.player, busy = k => s.pending.some(c => c.kind === k), ex = s.exercise || 'none', away = s.trip && s.trip.until > w.day;
    return `${away ? `<p><b>${esc(T('trip.on', { trip: T(`trip.${s.trip.kind}`), date: U.fmtDate(s.trip.until) }))}</b></p>` : ''}<div class="life-cats"><button data-doctor="1" ${busy('SEE_DOCTOR') ? 'disabled' : ''}>${esc(T('health.doctor'))}</button><button data-counselling="1" ${busy('COUNSELLING') ? 'disabled' : ''}>${esc(T('health.counselling', { cost: U.fmtMoney(Math.round(0.05 * Pl.typicalPay(w))) }))}</button><button data-rest="1" ${busy('REST') ? 'disabled' : ''}>${esc(T('health.rest'))}</button></div>
      <h4>${esc(T('health.exercise'))}</h4><div class="life-cats" role="group">${['none', 'light', 'regular'].map(k => `<button class="${ex === k ? 'on' : ''}" data-exercise="${k}" aria-pressed="${ex === k}">${esc(T(`exercise.${k}`))}</button>`).join('')}</div>
      <h4>${esc(T('health.trips'))}</h4><div class="life-cats">${Object.keys(Pl.TRIPS).map(k => `<button data-travel="${k}" ${busy('TRAVEL') || away ? 'disabled' : ''}>${esc(T(`trip.${k}`))} · ${U.fmtMoney(Pl.tripCost(w, k))} · ${esc(T('health.days', { count: Pl.TRIPS[k].days }))}</button>`).join('')}</div>
      <p class="note">${esc(T('health.note'))}</p>`;
  }
  // The life has ended: who comes next (a child or grandchild, someone random, someone you pick) or just watch.
  // "A life remembered": the life that just ended, in a few lines (from the engine's own records).
  function rememberHtml(w) {
    const s = w.player, e = s.ended, p = w.people[e.id];
    const kids = p.children.length, grand = p.children.reduce((t, id) => t + w.people[id].children.length, 0);
    const qual = p.quals.length ? (LES.C.COURSE_BY_ID[p.quals[p.quals.length - 1]] || { name: p.quals[p.quals.length - 1] }).name : '';
    const big = (s.moments || []).filter(m => m.big && m.day >= (e.since || 0) && m.day <= e.day).slice(-6);
    const partner = s.married ? w.people[s.married.pid] : p.partnerId !== null ? w.people[p.partnerId] : null;
    return `<div class="card life-remember"><canvas id="life-remember-pic" width="72" height="96" aria-hidden="true"></canvas><div><h3>${esc(T('remember.title'))}</h3><div class="life-name">${esc(P.name(p))}</div>
      <div class="muted">${esc(T('remember.years', { from: U.fmtDate(p.birthDay), to: U.fmtDate(e.day), age: e.age }))}${e.why === 'died' && p.causeOfDeath ? ` · ${esc(p.causeOfDeath)}` : ''}</div>
      <ul class="list-plain small">${partner ? `<li>❤️ ${esc(T('remember.partner', { other: P.name(partner) }))}</li>` : ''}<li>👪 ${esc(T('remember.family', { kids, grand }))}</li>${qual ? `<li>🎓 ${esc(qual)}</li>` : ''}<li>💰 ${esc(T('remember.worth', { worth: U.fmtMoney(e.nw || 0) }))}</li></ul>
      ${big.length ? `<div class="life-chips">${big.map(m => `<span class="life-chip">${esc(T(`moment.${m.kind}`, m.params))}</span>`).join('')}</div>` : ''}</div></div>`;
  }
  function successionHtml(w) {
    const s = w.player, e = s.ended, who = w.people[e.id], heirs = Pl.heirs(w);
    const res = Pl.search(w, UI._lifeSearch || '', 10);
    return `${rememberHtml(w)}<div class="card"><h3>${esc(T(e.why === 'died' ? 'succ.died' : 'succ.left', { name: P.name(who), age: e.age }))}</h3>${s.spectator ? `<p class="muted">${esc(T('succ.watching'))}</p>` : `<p>${esc(T('succ.intro'))}</p>`}
      <h4>${esc(T('succ.heirs'))}</h4>${heirs.length ? `<ul class="list-plain">${heirs.map(q => `<li><span>${UI.plink(w, q.id)} <small class="muted">${Math.floor(P.age(w, q))}</small></span><button class="ghost small" data-succ="${q.id}" data-how="heir">${esc(T('succ.take'))}</button></li>`).join('')}</ul>` : `<p class="muted">${esc(T('succ.noHeirs'))}</p>`}
      <h4>${esc(T('succ.other'))}</h4><button class="ghost" data-succrandom="1">🎲 ${esc(T('succ.random'))}</button>
      <label class="life-search">${esc(T('succ.search'))} <input id="life-search" type="search" value="${esc(UI._lifeSearch || '')}" placeholder="${esc(T('succ.searchPh'))}" autocomplete="off"></label>
      <ul class="list-plain" id="life-search-res">${res.map(q => `<li><span>${UI.plink(w, q.id)} <small class="muted">${Math.floor(P.age(w, q))}</small></span><button class="ghost small" data-succ="${q.id}" data-how="chosen">${esc(T('succ.take'))}</button></li>`).join('')}</ul>
      ${s.spectator ? '' : `<button class="link" data-spectate="1">${esc(T('succ.spectate'))}</button>`}</div>
      <div class="card"><h3>${esc(T('succ.lives'))}</h3><ol class="life-lives">${s.chain.map((c, i) => { const q = w.people[c.id], end = s.chain[i + 1] ? s.chain[i + 1].day : e.day; return `<li>${UI.plink(w, c.id)} <small class="muted">${esc(T(`succ.how.${c.how}`))} · ${U.fmtDate(c.day)} – ${U.fmtDate(end)}${q && !q.alive ? ` · ${esc(T('succ.diedAt', { age: Math.floor(P.age(w, q)) }))}` : ''}</small></li>`; }).join('')}</ol></div>`;
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
  // Your own business: run it (put money in, sell, close) or start one the engine would allow.
  function bizHtml(w, p) {
    if (!Pl.bizTypes) return '';
    const s = w.player, busy = k => s.pending.some(c => c.kind === k), b = p.manages >= 0 && w.biz[p.manages] && w.biz[p.manages].open ? w.biz[p.manages] : null;
    if (b) return `<h4>${esc(T('biz.yours'))}</h4><p>${esc(T('biz.now', { biz: b.name, cash: U.fmtMoney(b.cash), value: U.fmtMoney(b.equity), debt: U.fmtMoney(b.debt) }))}</p><div class="life-cats"><button data-inject="0.25" ${busy('INJECT') ? 'disabled' : ''}>${esc(T('biz.inject'))}</button><button data-sellbiz="1" ${busy('SELL_BIZ') ? 'disabled' : ''}>${esc(T('biz.sell'))}</button><button data-closebiz="1" ${busy('CLOSE_BIZ') ? 'disabled' : ''}>${esc(T('biz.close'))}</button></div>`;
    const ts = Pl.bizTypes(w, p).slice(0, 8);
    return `<details class="life-more" ${keep('startbiz')}><summary>${esc(T('biz.start'))}</summary><ul class="list-plain life-jobs">${ts.map(t => `<li><span><b>${esc(t.name)}</b><br><small class="muted">${esc(T('biz.capital', { capital: U.fmtMoney(t.capital) }))}${t.ok ? '' : ` · ${esc(T('learn.cost'))}`}</small></span><button class="ghost small" data-startbiz="${t.id}" ${!t.ok || busy('START_BIZ') ? 'disabled' : ''}>${esc(T('biz.go'))}</button></li>`).join('')}</ul><p class="note">${esc(T('biz.note'))}</p></details>`;
  }
  // Giving, volunteering, newcomers, elections.
  function communityHtml(w, p) {
    const s = w.player, busy = k => s.pending.some(c => c.kind === k), g = w.gov, elect = g && LES.Gov && !LES.Gov.appointed();
    const newcomers = w.living.filter(q => q.alive && !q.away && q.migrant && P.isAdult(w, q) && q.arrivedDay !== null && q.arrivedDay > w.day - 90).slice(0, 4);
    const amt = Math.max(w.px(20), Math.round(0.02 * Pl.typicalPay(w)));
    return `<div class="life-cats"><button data-volunteer="1" ${busy('VOLUNTEER') ? 'disabled' : ''}>${esc(T('com.volunteer'))}</button><button data-donate="${amt}" ${busy('DONATE') ? 'disabled' : ''}>${esc(T('com.donate', { amt: U.fmtMoney(amt) }))}</button></div>
      ${elect ? `<h4>${esc(T('com.election'))}</h4><p>${esc(T('com.next', { date: U.fmtDate(g.electionDay), title: LES.Gov.title(w) }))}</p>${s.stand ? `<p class="muted">${esc(T('com.standing'))}</p>` : `<button class="ghost small" data-stand="1" ${busy('STAND') || P.age(w, p) < 21 ? 'disabled' : ''}>${esc(T('com.stand'))}</button>`}` : ''}
      ${newcomers.length ? `<h4>${esc(T('com.newcomers'))}</h4><ul class="list-plain">${newcomers.map(q => `<li><span>${UI.plink(w, q.id)}</span><button class="ghost small" data-welcome="${q.id}">${esc(T('com.welcome'))}</button></li>`).join('')}</ul>` : ''}
      <p class="note">${esc(T('com.note'))}</p>`;
  }
  function workHtml(w, p) {
    if (!p.adult) return `<p class="muted">${esc(T('cat.youngWork'))}</p>`;
    const s = w.player, apps = s.apps || [], waiting = s.pending.filter(c => c.kind === 'APPLY_JOB').map(c => c.args.vac);
    const list = Pl.openings(w, p, true).slice(0, 8), busy = k => s.pending.some(c => c.kind === k);
    const old = P.age(w, p) >= 55 && !p.retired && Pl.HANDLERS.RETIRE ? `<div class="life-cats"><button data-retire="1" ${busy('RETIRE') ? 'disabled' : ''}>${esc(T('work.retire'))}</button>${p.job && !s.keepWorking && P.age(w, p) >= 58 ? `<button data-keep="1" ${busy('KEEP_WORKING') ? 'disabled' : ''}>${esc(T('work.keep'))}</button>` : ''}</div>` : '';
    const now = p.job ? `<p>${esc(T('work.now', { job: p.job.title, pay: U.fmtMoney(p.job.salary), date: U.fmtDate(p.job.startDay) }))}</p>${Pl.HANDLERS.ASK_RAISE && !p.job.fixedTitle ? `<button class="ghost small" data-raise="1" ${busy('ASK_RAISE') ? 'disabled' : ''}>${esc(T('work.raise'))}</button> <button class="ghost small" data-quit="1" ${busy('QUIT_JOB') ? 'disabled' : ''}>${esc(T('work.quit'))}</button>` : ''}` : '';
    const when = v => { const d = v.closeDay - w.day; return d > 0 ? T('time.inDays', { count: d }) : T('time.today'); };
    return `${now}${old}${bizHtml(w, p)}${apps.length ? `<h4>${esc(T('jobs.yourApps'))}</h4><ul class="list-plain">${apps.map(a => `<li><span>📄 ${esc(a.title)} · ${U.fmtMoney(a.salary)}</span><span class="muted">${esc(T('jobs.decides', { when: a.closeDay > w.day ? T('time.inDays', { count: a.closeDay - w.day }) : T('time.today') }))}</span></li>`).join('')}</ul>` : ''}
      <h4>${esc(T('jobs.openings'))}</h4>
      ${list.length ? `<ul class="list-plain life-jobs">${list.map(v => {
        const applied = v.appSet.has(p.id), queued = waiting.includes(v.id);
        return `<li><span><b>${esc(v.job.title)}</b> · ${U.fmtMoney(v.salary)}<br><small class="muted">${esc(T('jobs.closes', { when: when(v) }))}</small></span>
          ${applied ? `<span class="muted">✓ ${esc(T('jobs.applied'))}</span>` : queued ? `<span class="muted">⏳ ${esc(T('jobs.waiting'))}</span>` : `<button class="ghost small" data-apply="${v.id}">${esc(T('jobs.apply'))}</button>`}</li>`;
      }).join('')}</ul>` : `<p class="muted">${esc(T('jobs.none'))}</p>`}
      <p class="note">${esc(T('jobs.note'))}</p>`;
  }

  // ======================= View A: the life hub (default) =======================
  // Who you are (mood, goal), decisions (important ones first), tomorrow's plan, six tiles that open their own
  // page, the latest lines of your story, settings. Views B (planner) and C (story) come next.
  const ICON = { work: '💼', money: '💰', love: '❤️', health: '🩺', learn: '🎓', community: '🤝', care: '🧸', friends: '👫' };
  const GROUP = { // the colour of a planned request in the day bar
    work: ['APPLY_JOB', 'ASK_RAISE', 'QUIT_JOB', 'START_BIZ', 'INJECT', 'SELL_BIZ', 'CLOSE_BIZ', 'RETIRE', 'KEEP_WORKING'],
    money: ['INVEST', 'SELL', 'BUY_STOCK', 'SELL_STOCK', 'MOVE_HOME', 'BUY_TICKET'],
    love: ['ASK_DATE', 'ASK_PARTNER', 'PROPOSE', 'SEPARATE', 'COUNSEL', 'BABY_WISH', 'CARE_CHILD', 'CHOOSE_SCHOOL', 'VISIT', 'GIFT', 'AFFAIR', 'END_AFFAIR', 'MAKE_FRIEND', 'ASK_CARE'],
    health: ['SEE_DOCTOR', 'COUNSELLING', 'REST', 'SET_EXERCISE', 'TRAVEL'],
    learn: ['ENROLL', 'DROP_OUT', 'SET_EFFORT', 'ASK_CLUB', 'QUIT_CLUB', 'ASK_SCHOOL', 'SET_PLAN', 'ASK_ALLOWANCE', 'STOP_SPENDING', 'SET_GOAL'],
    community: ['DONATE', 'VOLUNTEER', 'STAND', 'WELCOME'],
  };
  const groupOf = k => Object.keys(GROUP).find(g => GROUP[g].includes(k)) || 'work';
  const name1 = p => (p ? p.first.split(' ')[0] : '');

  // Every button that asks for something: its request kind and arguments (clicks, and greying out what cannot happen).
  const num = v => Number(v);
  // The number typed next to a share button (the box in the same row; the story view can show the same list).
  const qty = (tk, b) => { const box = (b && b.closest('li') && b.closest('li').querySelector('input[type=number]')) || $(`stk-${tk}`); return Math.floor(num(box ? box.value : 0)); };
  const ACTIONS = {
    apply: ['APPLY_JOB', v => ({ vac: num(v) })], care: ['ASK_CARE', () => ({})], effort: ['SET_EFFORT', v => ({ level: v })], club: ['ASK_CLUB', v => ({ club: v })],
    quitclub: ['QUIT_CLUB', () => ({})], allow: ['ASK_ALLOWANCE', v => ({ chores: v === '1' })], friend: ['MAKE_FRIEND', v => ({ pid: num(v) })], school: ['ASK_SCHOOL', v => ({ tier: v })],
    plan: ['SET_PLAN', v => ({ plan: v })], raise: ['ASK_RAISE', () => ({})], quit: ['QUIT_JOB', () => ({})], enroll: ['ENROLL', v => ({ course: v })], dropout: ['DROP_OUT', () => ({})],
    invest: ['INVEST', v => ({ share: num(v) })], sell: ['SELL', v => ({ share: num(v) })], home: ['MOVE_HOME', v => ({ tier: num(v) })],
    buystock: ['BUY_STOCK', (v, w, b) => ({ tk: v, shares: qty(v, b) || 1 })], sellstock: ['SELL_STOCK', (v, w, b) => ({ tk: v, shares: qty(v, b) || 1 })],
    sellall: ['SELL_STOCK', (v, w) => ({ tk: v, shares: Pl.held(Pl.person(w), v) || 1 })], retire: ['RETIRE', () => ({}), 'work.retireSure'], keep: ['KEEP_WORKING', () => ({})],
    doctor: ['SEE_DOCTOR', () => ({})], counselling: ['COUNSELLING', () => ({})], rest: ['REST', () => ({})], exercise: ['SET_EXERCISE', v => ({ level: v })], travel: ['TRAVEL', v => ({ kind: v })],
    startbiz: ['START_BIZ', v => ({ type: v })], inject: ['INJECT', v => ({ share: num(v) })], sellbiz: ['SELL_BIZ', () => ({}), 'biz.sure'], closebiz: ['CLOSE_BIZ', () => ({}), 'biz.sure'],
    ticket: ['BUY_TICKET', () => ({})], donate: ['DONATE', v => ({ amt: num(v) })], volunteer: ['VOLUNTEER', () => ({})], stand: ['STAND', () => ({})], welcome: ['WELCOME', v => ({ pid: num(v) })],
    date: ['ASK_DATE', v => ({ pid: num(v) })], partner: ['ASK_PARTNER', v => ({ pid: num(v) })], propose: ['PROPOSE', v => ({ kind: v })], counsel: ['COUNSEL', () => ({})],
    separate: ['SEPARATE', () => ({}), 'love.sure'], baby: ['BABY_WISH', v => ({ wish: v })], endaffair: ['END_AFFAIR', () => ({})], carekid: ['CARE_CHILD', v => ({ pid: num(v) })],
    visit: ['VISIT', v => ({ pid: num(v) })], gift: ['GIFT', v => ({ pid: num(v), share: 0.1 })], goal: ['SET_GOAL', v => ({ goal: v })],
  };
  const actionOf = b => { for (const k of Object.keys(ACTIONS)) if (b.dataset[k] !== undefined && b.dataset[k] !== '') return [k, ACTIONS[k]]; return null; };
  const whyText = (w, kind, args, r) => LES.I18n.render(Pl.whyNot(w, kind, args, r));
  // After a redraw: grey out what cannot happen tomorrow (it can still be clicked, to say why).
  function markAvailability(el, w) {
    for (const b of el.querySelectorAll('button')) {
      if (b.disabled || b.dataset.choice) continue;
      const a = actionOf(b);
      if (!a) continue;
      const [, [kind, argsOf]] = a, args = argsOf(b.dataset[a[0]], w, b), r = Pl.check(w, kind, args);
      if (!r.ok) { b.classList.add('off'); b.setAttribute('aria-disabled', 'true'); b.title = whyText(w, kind, args, r); }
    }
  }

  function portrait(c, w, p) {
    if (!c || !p) return;
    const g = c.getContext('2d'), age = P.age(w, p);
    g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    const spr = LES.Sprites.person(LES.Sprites.lookOf(p, age), age < 3 ? 'baby' : !p.adult ? 'child' : age >= 65 ? 'elder' : 'adult', 0);
    const k = Math.max(1, Math.floor(Math.min((c.width - 4) / spr.width, (c.height - 8) / spr.height)));
    g.drawImage(spr, Math.round((c.width - spr.width * k) / 2), Math.round((c.height - spr.height * k) / 2), spr.width * k, spr.height * k);
  }
  const ring = (v, label, colour) => `<div class="life-ring" style="--v:${U.clamp(Math.round(v), 0, 100)};--c:${colour}"><b>${Math.round(v)}</b><small>${esc(label)}</small></div>`;

  function headHtml(w, p, sm) {
    const goal = p.goal && LES.Goals ? LES.Goals.DEFS[p.goal.id] : null, prog = goal && goal.progress ? U.clamp(goal.progress(w, p, p.goal), 0, 1) : 0;
    const goals = P.age(w, p) >= 16 && Pl.goals ? Pl.goals(w, p) : [];
    return `<div class="card life-head">
        <canvas class="portrait" id="life-portrait" width="64" height="88" aria-hidden="true"></canvas>
        <div class="life-who"><div class="life-name">${esc(sm.name)}</div>
          <div class="muted">${esc(T('life.ageStage', { age: sm.age, stage: T(`life.${sm.stage}`) }))}${UI.app.region ? ` · ${esc(LES.townName(w))}` : ''}</div>
          <div>${esc(status(w, p))}</div>
          ${p.alive ? `<div class="life-mood">“${esc(LES.I18n.render(Pl.mood(w, p)))}”</div>` : ''}
          ${p.adult || p.nw > 0 ? `<div class="life-money">${esc(T('life.cash'))} <b>${U.fmtMoney(p.cash)}</b> · ${esc(T('life.worth'))} <b>${U.fmtMoney(p.nw)}</b></div>` : ''}</div>
        ${p.alive ? `<div class="life-rings">${ring(p.health, T('life.health'), 'var(--green)')}${ring(p.happy, T('life.happy'), 'var(--teal)')}${ring(p.stress, T('life.stress'), 'var(--red)')}</div>` : ''}
      </div>
      ${goals.length && p.alive ? `<details class="card life-goal" ${keep('goal')}><summary>${goal ? `${goal.icon} <b>${esc(LES.Goals.text(p.goal))}</b><span class="life-goalbar"><i style="width:${Math.round(prog * 100)}%"></i></span>` : esc(T('goal.none'))} <small class="muted">${esc(T('goal.change'))}</small></summary>
        <div class="life-cats">${goals.map(id => { const d = LES.Goals.DEFS[id]; return `<button data-goal="${id}" class="${goal && p.goal.id === id ? 'on' : ''}">${d.icon} ${esc(d.name)}</button>`; }).join('')}</div><p class="note">${esc(T('goal.note'))}</p></details>` : ''}`;
  }

  function decisionsHtml(w, p) {
    const inbox = (w.player.inbox || []).slice().sort((a, b) => (Pl.isImportant(b) ? 1 : 0) - (Pl.isImportant(a) ? 1 : 0));
    if (!inbox.length) return '';
    return `<div class="card life-decisions"><h3>${esc(T('life.decisions'))} <small class="life-count">${inbox.length}</small></h3>${inbox.map(item => {
      const e = Pl.eventById(item.ev), imp = Pl.isImportant(item), left = item.expires - w.day, ps = Object.assign({ name: P.name(p) }, item.params || {});
      const choices = e.choices.map(c => {
        let why = '';
        if (!c.story) { const args = c.target ? Pl.TARGETS[c.target](w, p, item) : {}; if (!args) why = T('cmd.error.no_target'); else { const r = Pl.check(w, c.cmd, args); if (!r.ok) why = whyText(w, c.cmd, args, r); } }
        return `<button class="ghost ${why ? 'off' : ''}" data-uid="${esc(item.uid)}" data-choice="${esc(c.id)}" ${why ? `aria-disabled="true" title="${esc(why)}"` : ''}>${esc(T(`ev.${e.id}.${c.id}`, ps))}${why ? `<small>${esc(why)}</small>` : ''}</button>`;
      }).join('');
      return `<div class="life-event ${imp ? 'imp' : ''}" role="group" aria-label="${esc(T(`ev.${e.id}.title`, ps))}">
        <div class="life-event-head"><b>${imp ? '★ ' : ''}${esc(T(`ev.${e.id}.title`, ps))}</b><small class="muted">${imp ? esc(T('life.important')) : esc(T('life.daysLeft', { count: left }))}</small></div>
        <p>${esc(T(`ev.${e.id}.body`, ps))}</p>
        <div class="life-choices">${choices}<button class="link" data-auto="${esc(item.uid)}">${esc(T('life.letDecide', { name: name1(p) }))}</button></div>
      </div>`;
    }).join('')}</div>`;
  }

  // Tomorrow: an 8-hour bar (one block per planned request), the requests with a cancel cross, and their cost.
  function tomorrowHtml(w, p) {
    const s = w.player, list = s.pending || [];
    const hrs = list.reduce((t, c) => t + ((Pl.HANDLERS[c.kind] || {}).hours || 0), 0), cost = list.reduce((t, c) => t + Pl.costOf(w, p, c.kind, c.args), 0);
    const seg = [];
    for (const c of list) for (let i = 0; i < ((Pl.HANDLERS[c.kind] || {}).hours || 0); i++) seg.push(groupOf(c.kind));
    while (seg.length < Pl.DAY_HOURS) seg.push('');
    return `<div class="card life-queue"><div class="life-qhead"><h3>${esc(T('tomorrow.title'))}</h3><small class="muted">${esc(T('tomorrow.used', { hours: hrs, max: Pl.DAY_HOURS }))}${cost ? ` · ${esc(T('tomorrow.cost', { cost: U.fmtMoney(cost) }))}` : ''}</small></div>
      <div class="life-day" aria-hidden="true">${seg.slice(0, Math.max(Pl.DAY_HOURS, seg.length)).map(g => `<i class="${g ? `g-${g}` : ''}"></i>`).join('')}</div>
      ${list.length ? `<div class="life-chips">${list.map(c => `<span class="life-chip g-${groupOf(c.kind)}">${ICON[groupOf(c.kind)] || ''} ${esc(LES.I18n.render(Pl.describe(w, c)))} <small>${esc(T('queue.hours', { count: (Pl.HANDLERS[c.kind] || {}).hours || 0 }))}</small><button class="x" data-cancel="${esc(c.id)}" aria-label="${esc(T('queue.cancel'))}" title="${esc(T('queue.cancel'))}">✕</button></span>`).join('')}</div>`
        : `<p class="muted small">${esc(T('tomorrow.empty', { name: name1(p) }))}</p>`}</div>`;
  }

  // The six areas of life (three for children), each a tile with how things stand, opening its own page.
  function tileInfo(w, p, k) {
    const s = w.player, q = p.partnerId !== null ? w.people[p.partnerId] : null;
    switch (k) {
      case 'work': return { text: status(w, p), idea: p.job ? Pl.check(w, 'ASK_RAISE', {}).ok : !p.retired && P.isAdult(w, p) && Pl.openings(w, p).length > 0 };
      case 'money': return { text: T('tile.money', { cash: U.fmtMoney(p.cash), inv: U.fmtMoney(P.invValue(w, p)) }), idea: p.cash > 6 * p.mcost && P.invValue(w, p) < p.cash * 0.2 };
      case 'love': {
        const kids = p.careOf.filter(id => w.people[id].alive && !P.isAdult(w, w.people[id])).length;
        const base = q && q.alive ? T(s.married && s.married.pid === q.id ? 'tile.married' : 'tile.partner', { other: name1(q) }) : s.dating && w.people[s.dating.pid] ? T('tile.dating', { other: name1(w.people[s.dating.pid]) }) : T('tile.single');
        return { text: kids ? `${base} · ${T('tile.kids', { count: kids })}` : base, idea: !!(s.dating && s.dating.dates >= 3) };
      }
      case 'health': return { text: s.trip && s.trip.until > w.day ? T('trip.on', { trip: T(`trip.${s.trip.kind}`), date: U.fmtDate(s.trip.until) }) : T('tile.health', { health: Math.round(p.health), ex: T(`exercise.${s.exercise || 'none'}`) }), idea: p.stress > 70 || p.health < 60 };
      case 'learn': return P.isAdult(w, p) ? { text: p.enrol ? T('life.status.study') : T('tile.courses', { count: Pl.courses ? Pl.courses(w, p).length : 0 }), idea: !p.enrol && !!Pl.courses && Pl.courses(w, p).some(c => c.chance > 0.6) }
        : { text: `${T(`school.${Pl.currentTier ? Pl.currentTier(w, p) : 'public'}`)}${s.club ? ` · ${T(`club.${s.club.id}`)}` : ''}`, idea: !s.club && P.age(w, p) >= 4 };
      case 'community': { const g = w.gov, el = g && LES.Gov && !LES.Gov.appointed(); return { text: el ? T('tile.election', { date: U.fmtDate(g.electionDay) }) : T('tile.volunteered', { count: s.volunteered || 0 }), idea: el && !s.stand && g.electionDay - w.day < 200 && P.age(w, p) >= 21 && g.president !== p.id }; }
      case 'care': { const g = Pl.carerOf(w, p); return { text: g ? T('tile.carer', { carer: name1(g) }) : p.guardian === 'WELFARE' ? T('care.welfare') : '—', idea: false }; }
      case 'friends': return { text: T('tile.friends', { count: (s.friends || []).length }), idea: !(s.friends || []).length };
      default: return { text: '', idea: false };
    }
  }
  const pageHtml = (w, p, k) => (k === 'work' ? workHtml(w, p) : k === 'care' ? careHtml(w, p) : k === 'learn' && !P.isAdult(w, p) ? learnHtml(w, p) : k === 'learn' ? adultLearnHtml(w, p)
    : k === 'money' ? moneyHtml(w, p) : k === 'love' ? loveHtml(w, p) : k === 'community' ? communityHtml(w, p) : k === 'health' ? healthHtml(w, p) : k === 'friends' ? friendsHtml(w, p) : '');
  function areasHtml(w, p, cats) {
    if (UI.lifePage && cats.includes(UI.lifePage)) {
      const k = UI.lifePage;
      return `<div class="card life-page"><div class="life-pagehead"><button class="ghost small" data-back="1">← ${esc(T('life.back'))}</button><b>${ICON[k]} ${esc(T(`cat.${k}`))}</b></div><div class="life-cat-body">${pageHtml(w, p, k)}</div></div>`;
    }
    UI.lifePage = null;
    return `<div class="life-tiles">${cats.map(k => { const t = tileInfo(w, p, k); return `<button class="life-tile" data-page="${k}">${t.idea ? '<span class="life-dot" title=""></span>' : ''}<span class="ic">${ICON[k]}</span><b>${esc(T(`cat.${k}`))}</b><small>${esc(t.text)}</small></button>`; }).join('')}</div>`;
  }

  function latestHtml(w) {
    const j = w.player.journal.slice(-3).reverse();
    return `<div class="card"><h3>${esc(T('life.latest'))}</h3>${j.length ? `<ul class="list-plain life-journal">${j.map(e => `<li class="${e.imp >= 2 ? 'big' : ''}"><small class="muted">${U.fmtDate(e.day)}</small> ${esc(LES.I18n.render(e))}</li>`).join('')}</ul>` : `<p class="muted">${esc(T('journal.empty'))}</p>`}
      <details class="life-more" ${keep('journal')}><summary>${esc(T('life.story'))}</summary>${journalHtml(w)}</details></div>`;
  }
  function journalHtml(w) {
    const j = w.player.journal.slice(-60).reverse();
    if (!j.length) return `<p class="muted">${esc(T('journal.empty'))}</p>`;
    return `<ul class="list-plain life-journal">${j.map(e => `<li class="${e.imp >= 2 ? 'big' : ''}"><small class="muted">${U.fmtDate(e.day)}</small> ${esc(LES.I18n.render(e))}</li>`).join('')}</ul>`;
  }
  UI.lifeView = pref('les-life-view', 'A');
  const VIEWS = [['A', '▦', 'view.hub'], ['B', '▤', 'view.planner'], ['C', '📖', 'view.story']];
  const viewsHtml = () => `<div class="life-views" role="group" aria-label="${esc(T('view.label'))}">${VIEWS.map(([k, ic, key]) => `<button data-view="${k}" class="${UI.lifeView === k ? 'on' : ''}" aria-pressed="${UI.lifeView === k}" >${ic} ${esc(T(key))}</button>`).join('')}</div>`;
  function settingsHtml(w) {
    const s = w.player;
    return `<details class="card life-settings" ${keep('settings')}><summary>${esc(T('life.settings'))}</summary>
        <label>${esc(T('freq.label'))} <select id="life-freq">${['important', 'balanced', 'detailed'].map(k => `<option value="${k}" ${(s.freq || 'balanced') === k ? 'selected' : ''}>${esc(T(`freq.${k}`))}</option>`).join('')}</select></label>
        <label>${esc(T('set.auto'))} <select id="life-auto"><option value="1" ${pref('les-life-auto', '1') === '1' ? 'selected' : ''}>${esc(T('set.autoYes', { name: name1(Pl.person(w)) }))}</option><option value="0" ${pref('les-life-auto', '1') === '0' ? 'selected' : ''}>${esc(T('set.autoNo'))}</option></select></label>
        <label><input type="checkbox" id="life-lotto" ${s.noLottery ? '' : 'checked'}> ${esc(T('life.lotto'))}</label>
        <label><input type="checkbox" id="life-sensitive" ${s.noSensitive ? '' : 'checked'}> ${esc(T('life.sensitive'))}</label>
        <label><input type="checkbox" id="life-mature" ${s.mature ? 'checked' : ''}> ${esc(T('life.mature'))}</label>
        <p class="note">${esc(T('set.note'))}</p></details>`;
  }

  // A control the player is using right now (a list that is open, a box being typed in): redrawing would throw it away.
  const busyWith = el => { const a = document.activeElement; return !!a && el.contains(a) && (a.tagName === 'SELECT' || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search|number)$/.test(a.type))); };
  UI.renderLife = function () {
    const el = $('tab-life');
    if (!el) return;
    if (busyWith(el)) return; // try again at the next redraw
    for (const d of el.querySelectorAll('details[data-keep]')) { if (d.open) UI._lifeOpen.add(d.dataset.keep); else UI._lifeOpen.delete(d.dataset.keep); } // as the player left them
    const w = where();
    if (!w) { el.innerHTML = `<div class="card"><p>${esc(T('life.none'))}</p></div>`; UI._lifeHtml = null; return; }
    if (w.player.waiting) { el.innerHTML = `<div class="card life-head"><div><div class="life-name">👶 ${esc(T('play.waiting'))}</div><p>${esc(T('life.waiting'))}</p></div></div>`; UI._lifeHtml = null; return; }
    const p = Pl.person(w), sm = Pl.summary(w), s = w.player, cats = catsFor(sm.stage);
    const html = `${viewsHtml()}${headHtml(w, p, sm)}
      ${s.ended ? successionHtml(w) : !p.alive ? `<div class="card"><p>${esc(T('life.dead', { name: sm.name }))}</p></div>` : `${decisionsHtml(w, p)}${tomorrowHtml(w, p)}${areasHtml(w, p, cats)}`}
      ${latestHtml(w)}${settingsHtml(w)}`;
    if (html === UI._lifeHtml && el.firstElementChild) return; // nothing changed: leave the page alone
    el.innerHTML = html; UI._lifeHtml = html;
    portrait($('life-portrait'), w, p);
    if (s.ended) portrait($('life-remember-pic'), w, w.people[s.ended.id]);
    if (p && p.alive && !s.ended) markAvailability(el, w);
  };

  // Clicks in the tab (one listener; the tab is redrawn often).
  const say = r => { if (r && r.error) UI.toast(esc(r.why ? LES.I18n.render(r.why) : T(`cmd.error.${r.error}`))); else if (r && r.command) UI.toast(esc(T('jobs.queued'))); UI._lifeHtml = null; UI._storyHtml = null; UI._planHtml = null; UI.update(true); };
  // One handler for every My life button, in the side panel and in the story view.
  function onLifeClick(e, el) {
      const b = e.target.closest('button');
      const w = where();
      if (!b || !w) return;
      const redraw = () => { UI._lifeHtml = null; UI._storyHtml = null; UI._planHtml = null; UI.update(true); };
      if (b.dataset.view) { UI.lifeView = b.dataset.view; UI.storyHidden = false; UI.planOpen = true; setPref('les-life-view', UI.lifeView); redraw(); if (UI.renderStory) UI.renderStory(); if (UI.renderPlanner) UI.renderPlanner(); return; }
      if (b.dataset.page) { UI.lifePage = b.dataset.page; redraw(); el.scrollTop = 0; return; }
      if (b.dataset.back) { UI.lifePage = null; redraw(); return; }
      if (b.dataset.cancel) { Pl.cancel(w, b.dataset.cancel); redraw(); return; }
      if (b.dataset.choice) { say(Pl.choose(w, b.dataset.uid, b.dataset.choice)); return; }
      if (b.dataset.auto) { Pl.autoDecide(w, b.dataset.auto); redraw(); return; }
      if (b.dataset.succ) { const err = Pl.succeed(w, Number(b.dataset.succ), b.dataset.how); if (err) UI.toast(esc(T(`succ.err.${err}`))); else { UI._lifeSearch = ''; UI.app.focusPlayer(); } redraw(); return; }
      if (b.dataset.succrandom) { const q = Pl.randomHeir(w); if (q && !Pl.succeed(w, q.id, 'random')) UI.app.focusPlayer(); redraw(); return; }
      if (b.dataset.spectate) { Pl.spectate(w); redraw(); return; }
      const a = actionOf(b);
      if (!a) return;
      const [k, [kind, argsOf, sure]] = a;
      if ((k === 'buystock' || k === 'sellstock') && !(qty(b.dataset[k], b) >= 1)) { UI.toast(esc(T('money.qtyBad'))); return; }
      const args = argsOf(b.dataset[k], w, b), r = Pl.check(w, kind, args);
      if (!r.ok) { UI.toast(esc(whyText(w, kind, args, r))); return; }
      if (sure && !confirm(T(sure))) return;
      say(Pl.plan(w, kind, args));
  }
  UI.initLife = function () {
    const el = $('tab-life');
    if (!el) return;
    el.addEventListener('click', e => onLifeClick(e, el));
    el.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.keep) { if (d.open) UI._lifeOpen.add(d.dataset.keep); else UI._lifeOpen.delete(d.dataset.keep); } }, true); // (toggle does not bubble)
    el.addEventListener('input', e => { // the search box: redraw only the results (keeps typing smooth)
      if (e.target.id && e.target.id.startsWith('stk-')) UI._lifeInputs[e.target.id] = e.target.value;
      const w = where();
      if (e.target.id !== 'life-search' || !w) return;
      UI._lifeSearch = e.target.value;
      const box = $('life-search-res');
      if (box) box.innerHTML = Pl.search(w, UI._lifeSearch, 10).map(q => `<li><span>${UI.plink(w, q.id)} <small class="muted">${Math.floor(P.age(w, q))}</small></span><button class="ghost small" data-succ="${q.id}" data-how="chosen">${esc(T('succ.take'))}</button></li>`).join('');
    });
    el.addEventListener('change', e => {
      const w = where();
      if (e.target.tagName === 'SELECT') e.target.blur(); // chosen: the page may redraw again
      if (e.target.id === 'life-freq' && w) w.player.freq = e.target.value;
      if (e.target.id === 'life-auto') setPref('les-life-auto', e.target.value);
      if (e.target.id === 'life-lotto' && w) { w.player.noLottery = !e.target.checked; UI.update(true); }
      if (e.target.id === 'life-sensitive' && w) w.player.noSensitive = !e.target.checked;
      if (e.target.id === 'life-mature' && w) w.player.mature = e.target.checked;
      if (e.target.dataset && e.target.dataset.kidschool && e.target.value && w) say(Pl.plan(w, 'CHOOSE_SCHOOL', { pid: Number(e.target.dataset.kidschool), tier: e.target.value }));
    });
  };

  // For the story and planner views (js/ui/life-story.js, life-planner.js): the same pieces and the same buttons.
  UI._life = { where, T, decisionsHtml, tomorrowHtml, pageHtml, successionHtml, portrait, ring, status, catsFor, ICON, groupOf, name1, tileInfo, markAvailability, onLifeClick, keep, busyWith: el => busyWith(el) };

  // ---- The clock: important decisions hold it; everyday ones are left to the character at fast speeds ----
  // An important decision is waiting: the clock stays stopped, and the decision is shown.
  UI.lifeBlocked = function () {
    const w = where(), item = w && !w.player.ended ? Pl.urgent(w) : null;
    if (!item) return false;
    UI.toast(`★ ${esc(T('life.decideFirst', { title: T(`ev.${item.ev}.title`, item.params || {}) }))}`, '', -1, true);
    UI.lifePage = null; UI.setTab('life'); UI._lifeHtml = null; UI.update(true);
    const card = document.querySelector('#tab-life .life-event.imp');
    if (card) { card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); card.scrollIntoView({ block: 'nearest' }); }
    return true;
  };

  // ---- Big moments: slow to 1x, a card, then back to the previous speed after 10 s unless you act ----
  const MOMENT_ICON = { born: '👶', school: '🎒', schoolDone: '🎓', graduated: '🎓', firstJob: '💼', together: '🏠', married: '💍', child: '👶', grandchild: '👶', business: '🏪', elected: '🏛️', retired: '🌅', lost: '🕯️', jackpot: '🎉' };
  let card = null, cardTimer = null, momentQ = [];
  function closeMoment(resume) {
    const app = UI.app;
    if (cardTimer) { clearInterval(cardTimer); cardTimer = null; }
    const m = card && card.m;
    if (card) { card.el.remove(); card = null; }
    if (resume && m && m.resumeIdx !== null && !UI.lifeBlocked()) app.setSpeed(m.resumeIdx);
    if (momentQ.length) showMoment(momentQ.shift());
  }
  function showMoment(m) {
    const app = UI.app, w = where(), p = w && Pl.person(w);
    if (!w || !p) return;
    if (card) { momentQ.push(m); return; }
    const el = document.createElement('div');
    el.className = `life-moment ${m.kind === 'lost' ? 'sad' : ''}`;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', T(`moment.${m.kind}`, m.params));
    el.innerHTML = `<canvas width="72" height="96" aria-hidden="true"></canvas><div class="life-moment-body"><div class="life-moment-ic">${MOMENT_ICON[m.kind] || '✨'}</div>
      <div class="life-moment-title">${esc(T(`moment.${m.kind}`, m.params))}</div><div class="muted">${esc(P.name(p))} · ${esc(T('life.ageStage', { age: Math.floor(P.age(w, p)), stage: T(`life.${Pl.stageOf(Math.floor(P.age(w, p)))}`) }))} · ${esc(U.fmtDate(m.day))}</div>
      <div class="life-moment-foot"><button class="primary" data-go="1">${esc(T('moment.continue'))}</button><span class="life-moment-count"></span></div></div>`;
    document.body.appendChild(el);
    portrait(el.querySelector('canvas'), w, p);
    card = { el, m };
    if (m.sound && LES.Audio && LES.Audio.play) LES.Audio.play(m.sound);
    let left = 10;
    const count = el.querySelector('.life-moment-count');
    const tick = () => { count.textContent = m.resumeIdx !== null ? T('moment.resume', { count: left }) : ''; };
    tick();
    if (m.resumeIdx !== null) cardTimer = setInterval(() => { left--; if (left <= 0) closeMoment(true); else tick(); }, 1000);
    el.querySelector('[data-go]').onclick = () => closeMoment(true);
    el.addEventListener('pointerdown', ev => { if (!ev.target.closest('[data-go]') && cardTimer) { clearInterval(cardTimer); cardTimer = null; count.textContent = T('moment.held'); } });
  }
  // Any other action by the player stops the countdown (they are busy; Continue restores the speed).
  document.addEventListener('keydown', () => { if (card && cardTimer) { clearInterval(cardTimer); cardTimer = null; const c = card.el.querySelector('.life-moment-count'); if (c) c.textContent = T('moment.held'); } }, true);

  // Every few hundred ms: what the clock should do for this life, new decisions, new moments, the end of a life.
  const seen = new Set();
  UI.watchLife = function () {
    const app = UI.app, w = where(), tab = document.querySelector('#tabs button[data-tab="life"]');
    if (tab) tab.classList.toggle('hidden', !w);
    if (UI.renderStory) UI.renderStory(); // view C (life story), when chosen
    if (UI.renderPlanner) UI.renderPlanner(); // view B (day planner), when chosen
    if (!w) return;
    const s = w.player;
    s.autoMinor = pref('les-life-auto', '1') === '1' && app.speedDps && app.speedDps() >= 1;
    s.stopOn = { important: true, minor: true, moments: true };
    if (w.pauseRequested && app.region && w !== app.world) { app.pauseReason = w.pauseRequested; w.pauseRequested = null; if (!app.paused) app.togglePause(); } // (another town of the region)
    if (UI._lifeWaiting && !s.waiting) { // Start at Birth: you have just been born
      UI._lifeWaiting = false; // first: focusPlayer redraws the panels, which comes back here
      if (!app.paused) app.togglePause();
      app.focusPlayer();
    }
    UI._lifeWaiting = !!s.waiting;
    const end = s.ended;
    if (end && UI._lifeEnded !== `${end.id}-${end.day}`) { // the life just ended: say so, and pause to choose
      UI._lifeEnded = `${end.id}-${end.day}`;
      if (w.day - end.day <= 1) { const t = UI.toast(`🕯️ ${esc(T(end.why === 'died' ? 'succ.died' : 'succ.left', { name: P.name(w.people[end.id]), age: end.age }))}`, U.fmtDate(w.day), -1, true); if (t) t.onclick = () => UI.setTab('life'); if (!app.paused) app.togglePause(); UI.setTab('life'); }
    }
    const inbox = s.inbox || [];
    if (tab) tab.dataset.count = inbox.length || '';
    for (const item of inbox) {
      if (seen.has(item.uid)) continue;
      seen.add(item.uid);
      if (w.day - item.day > 1) continue; // already there (a loaded save)
      const imp = Pl.isImportant(item), t = UI.toast(`${imp ? '★' : '📩'} ${esc(T('life.newDecision', { title: T(`ev.${item.ev}.title`, item.params || {}) }))}`, U.fmtDate(w.day), -1, true);
      if (t) t.onclick = () => UI.setTab('life');
      if (imp || !s.autoMinor) { UI.lifePage = null; UI.setTab('life'); }
    }
    // Moments: small ones as a toast; big ones slow the clock to 1x with a card (unless a decision holds it).
    const ms = s.moments || [];
    if (UI._momentSeq === undefined) UI._momentSeq = ms.length ? ms[ms.length - 1].seq : 0; // (a loaded game: old moments are not replayed)
    for (const m of ms) {
      if (m.seq <= UI._momentSeq) continue;
      UI._momentSeq = m.seq;
      if (w.day - m.day > 2) continue;
      if (!m.big) { UI.toast(`✨ ${esc(T(`moment.${m.kind}`, m.params))}`, U.fmtDate(m.day), s.id, false); continue; }
      const was = app.pauseReason === 'moment' || !app.paused ? app.speedIdx : null;
      app.pauseReason = null;
      const blocked = !!Pl.urgent(w);
      const m2 = Object.assign({}, m, { resumeIdx: blocked || was === null || was === 0 ? null : was });
      if (!blocked && was !== null) app.setSpeed(0); // 1x: the town keeps moving while you take it in
      showMoment(m2);
    }
  };
})(globalThis.LES = globalThis.LES || {});
