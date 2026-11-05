// The town newspaper window (Events tab → Newspaper): one issue a month from LES.News, with the lead story,
// other stories, the month in numbers and back/forward through the archive. LES.NewsUI.frontPage is also
// used by the report (one front page a decade).
(function (LES) {
  'use strict';
  const U = LES.U, esc = U.esc;
  const NU = LES.NewsUI = {};
  const KICKER = { economy: 'Economy', biz: 'Business', politics: 'Politics', crime: 'Crime', life: 'Life', luck: 'Life', family: 'Families', society: 'Community', health: 'Health', edu: 'Education', career: 'Work', money: 'Money', region: 'Region' };
  const kicker = c => KICKER[c] || 'Town';

  // The month's numbers from the history row closest to the issue.
  function numbers(w, iss) {
    const h = w.history;
    let i = h.length - 1;
    while (i > 0 && h[i].day > iss.day) i--;
    const r = h[i] || {}, p = h[Math.max(0, i - 12)] || r;
    const lab = (r.employed || 0) + (r.unemployed || 0) + (r.owners || 0);
    return [
      ['People', `${r.pop || 0}${p.pop ? ` (${r.pop >= p.pop ? '+' : ''}${(r.pop || 0) - p.pop} in a year)` : ''}`],
      ['Born / died', `${iss.births} / ${iss.deaths}`],
      ['Arrived / left', `${iss.arrived} / ${iss.left}`],
      ['Unemployment', lab ? `${((r.unemployed || 0) / lab * 100).toFixed(1)}%` : '–'],
      ['Median wealth', U.fmtMoney(r.median || 0)],
      ['Businesses opened / closed', `${iss.opened} / ${iss.closed}`],
      [`${LES.Countries.pack.names.exchangeShort} index`, r.idx ? `${r.idx.toFixed(0)}${p.idx ? ` (${r.idx >= p.idx ? '+' : ''}${((r.idx / p.idx - 1) * 100).toFixed(0)}% in a year)` : ''}` : '–'],
      ['Inflation', r.infl !== undefined ? `${(r.infl * 100).toFixed(1)}%` : '–'],
    ];
  }
  const link = (w, s) => (s.pid >= 0 && w.people[s.pid] ? ` data-pid="${s.pid}"` : '');

  NU.frontPage = function (w, idx, compact) {
    const is = (w.news && w.news.issues) || [], iss = is[idx];
    if (!iss) return '<p class="note">No issue yet: the first one comes out at the end of the first month.</p>';
    const [lead, ...rest] = iss.stories, d = U.dayToDate(iss.day);
    const fest = LES.Calendar.festival(iss.day);
    return `<div class="paper${compact ? ' compact' : ''}">
      <div class="paper-mast"><span>No. ${iss.no}</span><b>${esc(LES.News.name(w))}</b><span>${U.MONTH_NAMES[d.month]} Year ${d.year}</span></div>
      ${lead ? `<div class="paper-lead"${link(w, lead)}><small>${kicker(lead.cat)}</small><div class="paper-h">${esc(lead.text)}</div></div>` : `<div class="paper-lead"><small>Town</small><div class="paper-h">A quiet month in ${esc(LES.townName(w))}${fest ? ` as ${esc(fest.name)} comes round` : ''}</div></div>`}
      ${rest.length ? `<div class="paper-cols">${rest.map(s => `<div class="paper-story"${link(w, s)}><small>${kicker(s.cat)}</small><p>${esc(s.text)}</p></div>`).join('')}</div>` : ''}
      ${compact ? '' : `<div class="paper-box"><b>The month in numbers</b><table>${numbers(w, iss).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`}
    </div>`;
  };

  NU.open = function (app, idx) {
    const w = app.world, is = (w.news && w.news.issues) || [], $ = id => document.getElementById(id), card = $('modal-card');
    if (idx === undefined || idx < 0) idx = is.length - 1;
    card.classList.add('wide'); card.onclick = null;
    card.innerHTML = `<h1>${esc(LES.News.name(w))}</h1><p class="lead">The town paper: the month's biggest stories and numbers. Click a story to follow the person in it.</p>
      ${NU.frontPage(w, idx)}
      <div class="modal-actions"><button class="ghost" id="np-first" ${idx <= 0 ? 'disabled' : ''}>« First</button><button class="ghost" id="np-prev" ${idx <= 0 ? 'disabled' : ''}>‹ Previous</button>
        <span class="spacer note">${is.length ? `Issue ${idx + 1} of ${is.length}` : ''}</span>
        <button class="ghost" id="np-next" ${idx >= is.length - 1 ? 'disabled' : ''}>Next ›</button><button class="ghost" id="np-last" ${idx >= is.length - 1 ? 'disabled' : ''}>Latest »</button><button class="primary" id="np-close">Close</button></div>`;
    $('modal').classList.remove('hidden');
    $('np-first').onclick = () => NU.open(app, 0);
    $('np-prev').onclick = () => NU.open(app, idx - 1);
    $('np-next').onclick = () => NU.open(app, idx + 1);
    $('np-last').onclick = () => NU.open(app, is.length - 1);
    $('np-close').onclick = () => $('modal').classList.add('hidden');
    for (const el of card.querySelectorAll('[data-pid]')) el.onclick = () => { $('modal').classList.add('hidden'); app.select(Number(el.dataset.pid), true); };
  };
})(globalThis.LES = globalThis.LES || {});
