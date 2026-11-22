// The town newspaper window (Events tab → Newspaper): one issue a month from LES.News, with the lead story,
// other stories, the month in numbers and back/forward through the archive. LES.NewsUI.frontPage is also
// used by the report (one front page a decade).
(function (LES) {
  'use strict';
  const U = LES.U, esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s), t = (k, p) => esc(T(k, p)); // PL-17
  const NU = LES.NewsUI = {};
  const KICKER = { economy: 1, biz: 1, politics: 1, crime: 1, life: 1, luck: 'life', family: 1, society: 1, health: 1, edu: 1, career: 1, money: 1, region: 1 };
  const kicker = c => t(`nw.k.${KICKER[c] === 1 ? c : KICKER[c] || 'town'}`);

  // The month's numbers from the history row closest to the issue.
  function numbers(w, iss) {
    const h = w.history;
    let i = h.length - 1;
    while (i > 0 && h[i].day > iss.day) i--;
    const r = h[i] || {}, p = h[Math.max(0, i - 12)] || r;
    const lab = (r.employed || 0) + (r.unemployed || 0) + (r.owners || 0);
    return [
      [T('nw.people'), `${r.pop || 0}${p.pop ? ` ${T('nw.inYear', { v: `${r.pop >= p.pop ? '+' : ''}${(r.pop || 0) - p.pop}` })}` : ''}`],
      [T('nw.born'), `${iss.births} / ${iss.deaths}`],
      [T('nw.arrived'), `${iss.arrived} / ${iss.left}`],
      [T('nw.unemp'), lab ? `${((r.unemployed || 0) / lab * 100).toFixed(1)}%` : '–'],
      [T('nw.median'), U.fmtMoney(r.median || 0)],
      [T('nw.biz'), `${iss.opened} / ${iss.closed}`],
      [T('pn.ch.index', { name: LES.Countries.pack.names.exchangeShort }), r.idx ? `${r.idx.toFixed(0)}${p.idx ? ` ${T('nw.inYear', { v: `${r.idx >= p.idx ? '+' : ''}${((r.idx / p.idx - 1) * 100).toFixed(0)}%` })}` : ''}` : '–'],
      [T('nw.infl'), r.infl !== undefined ? `${(r.infl * 100).toFixed(1)}%` : '–'],
    ];
  }
  const link = (w, s) => (s.pid >= 0 && w.people[s.pid] ? ` data-pid="${s.pid}"` : '');

  NU.frontPage = function (w, idx, compact) {
    const is = (w.news && w.news.issues) || [], iss = is[idx];
    if (!iss) return `<p class="note">${t('nw.none')}</p>`;
    const [lead, ...rest] = iss.stories, d = U.dayToDate(iss.day);
    const fest = LES.Calendar.festival(iss.day);
    return `<div class="paper${compact ? ' compact' : ''}">
      <div class="paper-mast"><span>${t('nw.no', { n: iss.no })}</span><b>${esc(LES.News.name(w))}</b><span>${t('nw.month', { month: U.MONTH_NAMES[d.month], year: d.year })}</span></div>
      ${lead ? `<div class="paper-lead"${link(w, lead)}><small>${kicker(lead.cat)}</small><div class="paper-h">${esc(LES.I18n.render(lead.text))}</div></div>` : `<div class="paper-lead"><small>${kicker('town')}</small><div class="paper-h">${fest ? t('nw.quietFest', { town: LES.townName(w), fest: G(fest.name) }) : t('nw.quiet', { town: LES.townName(w) })}</div></div>`}
      ${rest.length ? `<div class="paper-cols">${rest.map(s => `<div class="paper-story"${link(w, s)}><small>${kicker(s.cat)}</small><p>${esc(LES.I18n.render(s.text))}</p></div>`).join('')}</div>` : ''}
      ${compact ? '' : `<div class="paper-box"><b>${t('nw.numbers')}</b><table>${numbers(w, iss).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`}
    </div>`;
  };

  NU.open = function (app, idx) {
    const w = app.world, is = (w.news && w.news.issues) || [], $ = id => document.getElementById(id), card = $('modal-card');
    if (idx === undefined || idx < 0) idx = is.length - 1;
    card.classList.add('wide'); card.onclick = null;
    card.innerHTML = `<h1>${esc(LES.News.name(w))}</h1><p class="lead">${t('nw.lead')}</p>
      ${NU.frontPage(w, idx)}
      <div class="modal-actions"><button class="ghost" id="np-first" ${idx <= 0 ? 'disabled' : ''}>« ${t('nw.first')}</button><button class="ghost" id="np-prev" ${idx <= 0 ? 'disabled' : ''}>‹ ${t('nw.prev')}</button>
        <span class="spacer note">${is.length ? t('nw.issue', { n: idx + 1, total: is.length }) : ''}</span>
        <button class="ghost" id="np-next" ${idx >= is.length - 1 ? 'disabled' : ''}>${t('nw.next')} ›</button><button class="ghost" id="np-last" ${idx >= is.length - 1 ? 'disabled' : ''}>${t('nw.latest')} »</button><button class="primary" id="np-close">${t('pn.tb.close')}</button></div>`;
    $('modal').classList.remove('hidden');
    $('np-first').onclick = () => NU.open(app, 0);
    $('np-prev').onclick = () => NU.open(app, idx - 1);
    $('np-next').onclick = () => NU.open(app, idx + 1);
    $('np-last').onclick = () => NU.open(app, is.length - 1);
    $('np-close').onclick = () => $('modal').classList.add('hidden');
    for (const el of card.querySelectorAll('[data-pid]')) el.onclick = () => { $('modal').classList.add('hidden'); app.select(Number(el.dataset.pid), true); };
  };
})(globalThis.LES = globalThis.LES || {});
