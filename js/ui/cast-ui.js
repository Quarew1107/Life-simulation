// My Cast: a creator for custom people, a roster kept in this browser (with JSON export and
// import), and the "★ My cast" list in the Leaders tab to add them and follow their lives.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, UI = LES.UI, esc = U.esc;
  const $ = id => document.getElementById(id);
  const KEY = 'les-cast-roster';
  const load = () => { try { const x = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
  const save = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ } };
  UI.castRoster = load;

  const RELS = [['', 'As usual for their community'], ['islam', 'Islam'], ['buddhism', 'Buddhism'], ['christianity', 'Christianity'], ['hinduism', 'Hinduism'], ['none', 'No religion']];
  const STYLES = [[0, 'Short hair'], [1, 'Long hair'], [2, 'Bun'], [3, 'Tudung (headscarf)']];
  const slider = (id, label, v, max) => `<label class="cast-sl"><span>${esc(label)}</span><input type="range" id="${id}" min="0" max="${max}" step="${max > 10 ? 1 : 0.1}" value="${v}"><b id="${id}-v">${v}</b></label>`;
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const colour = (id, v) => `<input type="color" id="${id}" value="${v}">`;

  UI.openCastCreator = function (idx) {
    const roster = load(), spec = idx >= 0 && roster[idx] ? JSON.parse(JSON.stringify(roster[idx])) : LES.Cast.blank();
    const card = $('modal-card');
    card.classList.add('wide');
    card.innerHTML = `<h1>${idx >= 0 ? 'Edit' : 'Create'} a person</h1><p class="lead">Design anyone you like. Once in town they follow the same rules as everyone else: their choices are still weighted dice rolls.</p>
      <div class="cast-grid">
        <div class="card"><h3>Who</h3><div class="form-grid">
          <div class="field"><label>First name</label><input id="c-first" type="text" maxlength="30" value="${esc(spec.first)}"></div>
          <div class="field"><label>Family name</label><input id="c-last" type="text" maxlength="30" value="${esc(spec.last)}"></div>
          <div class="field"><label>Sex</label>${sel('c-sex', [['F', 'Female'], ['M', 'Male']], spec.sex)}</div>
          <div class="field"><label>Age</label><input id="c-age" type="number" min="18" max="90" value="${spec.age}"></div>
          <div class="field"><label>Ethnicity</label>${sel('c-eth', C.ETHNICITIES.map(e => [e, C.ETHNIC_NAMES[e]]), spec.eth)}</div>
          <div class="field"><label>Religion</label>${sel('c-rel', RELS, spec.rel)}</div>
          <div class="field"><label>Qualification</label>${sel('c-qual', LES.Cast.QUALS, spec.qual)}</div>
          <div class="field"><label>Life strategy</label>${sel('c-strat', C.STRATEGIES.map(s => [s, C.STRATEGY_NAMES[s]]), spec.strategy)}</div>
          <div class="field"><label>Money they bring (Year-1 RM)</label><input id="c-cash" type="number" min="0" max="1000000000" value="${spec.cash}"></div>
        </div></div>
        <div class="card"><h3>Abilities <small class="muted">0-10</small></h3>${C.ATTR_NAMES.map((n, i) => slider(`c-a${i}`, n, spec.att[i], 10)).join('')}
          <h3 style="margin-top:8px">Personality <small class="muted">0-100</small></h3>${C.PERS.map(k => slider(`c-p-${k}`, C.PERS_NAMES[k], spec.pers[k], 100)).join('')}${slider('c-fam', 'Wish for a family', spec.famDesire, 100)}${slider('c-relig', 'Devotion', spec.relig, 100)}</div>
        <div class="card"><h3>Looks</h3><div class="cast-looks">
          <label>Skin ${colour('c-skin', spec.look.skin)}</label><label>Hair ${colour('c-hair', spec.look.hair)}</label>
          <label>Shirt ${colour('c-shirt', spec.look.shirt)}</label><label>Trousers ${colour('c-pants', spec.look.pants)}</label>
          <label>Headscarf ${colour('c-scarf', spec.look.scarf)}</label><label>Hair style ${sel('c-style', STYLES, spec.look.style)}</label></div>
          <canvas id="c-preview" width="120" height="150"></canvas></div>
      </div>
      <div class="modal-actions"><button class="ghost" id="c-random">🎲 Random</button><span class="spacer"></span><button class="ghost" id="c-cancel">Cancel</button><button class="ghost" id="c-save">Save to my cast</button><button class="primary" id="c-add">Save and add to town</button></div>`;
    $('modal').classList.remove('hidden');
    const read = () => ({
      first: $('c-first').value.trim() || 'Nameless', last: $('c-last').value.trim(), sex: $('c-sex').value, age: Number($('c-age').value) || 25, eth: $('c-eth').value, rel: $('c-rel').value,
      relig: Number($('c-relig').value), qual: $('c-qual').value, strategy: $('c-strat').value, cash: Math.max(0, Number($('c-cash').value) || 0),
      att: C.ATTR.map((_, i) => Number($(`c-a${i}`).value)), pers: Object.fromEntries(C.PERS.map(k => [k, Number($(`c-p-${k}`).value)])), famDesire: Number($('c-fam').value),
      look: { skin: $('c-skin').value, hair: $('c-hair').value, shirt: $('c-shirt').value, pants: $('c-pants').value, scarf: $('c-scarf').value, style: Number($('c-style').value) },
    });
    const preview = () => {
      const cv = $('c-preview'), g = cv.getContext('2d'), s = read();
      g.fillStyle = '#5f8a45'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
      const spr = LES.Sprites.person(s.look, s.age >= 60 ? 'elder' : 'adult', 0, null, 'front');
      g.drawImage(spr, 30, 15, spr.width * 6, spr.height * 6);
      for (const el of card.querySelectorAll('.cast-sl input')) $(`${el.id}-v`).textContent = el.value;
    };
    card.oninput = preview; card.onchange = preview; preview();
    const store = () => { const list = load(), s = read(); if (idx >= 0 && list[idx]) list[idx] = s; else list.push(s); save(list); return s; };
    $('c-cancel').onclick = () => $('modal').classList.add('hidden');
    $('c-save').onclick = () => { store(); $('modal').classList.add('hidden'); UI.renderLeaders(true); };
    $('c-add').onclick = () => { const s = store(); $('modal').classList.add('hidden'); UI.addCast(s); };
    $('c-random').onclick = () => {
      const r = () => Math.random();
      for (let i = 0; i < 6; i++) $(`c-a${i}`).value = (2 + r() * 8).toFixed(1);
      for (const k of C.PERS) $(`c-p-${k}`).value = Math.round(r() * 100);
      $('c-fam').value = Math.round(r() * 100); $('c-age').value = 18 + Math.floor(r() * 40);
      const eth = C.ETHNICITIES[Math.floor(r() * C.ETHNICITIES.length)], sex = r() < 0.5 ? 'M' : 'F', N = C.NAMES[eth];
      $('c-eth').value = eth; $('c-sex').value = sex; $('c-first').value = N[sex][Math.floor(r() * N[sex].length)]; $('c-last').value = N.last[Math.floor(r() * N.last.length)];
      $('c-skin').value = C.SKIN[eth][Math.floor(r() * C.SKIN[eth].length)];
      preview();
    };
  };

  UI.addCast = function (spec) {
    const app = UI.app, w = app.world;
    if (!w || w.ended) return;
    try { const p = LES.Cast.add(w, spec); app.select(p.id, true); UI.toast(`★ ${esc(P.name(p))} arrived in ${esc(LES.townName(w))}`); }
    catch (e) { console.error(e); UI.toast(`Could not add ${esc(spec.first)}: ${esc(e.message)}`); }
    UI.renderLeaders(true);
  };

  // The "★ My cast" list: the saved roster (add, edit, remove, export, import) and the cast
  // members living in this town, with what they are doing now.
  UI.renderCast = function (force) {
    const app = UI.app, w = app.world, roster = load(), el = $('lb-list');
    if (!force && el.contains(document.activeElement)) return;
    const live = w.people.filter(p => p.custom);
    const status = p => (!p.alive ? `died aged ${Math.floor(P.age(w, p))}` : p.away ? 'living elsewhere' : p.inst ? 'in prison or rehab' : p.job ? LES.Labour.title(p.job) : p.manages >= 0 ? `runs ${w.biz[p.manages].name}` : p.retired ? 'retired' : p.enrol ? 'studying' : 'looking for work');
    el.innerHTML = `<div class="card"><h3>Your cast in ${esc(LES.townName(w))}</h3>
      ${live.length ? live.map(p => `<div class="lb-row ${p.id === app.selected ? 'sel' : ''}" data-pid="${p.id}"><span class="rank">★</span><span class="dot" style="background:${C.STRATEGY_COLORS[p.strategy]}"></span>
        <span><div class="nm">${esc(P.name(p))}${p.alive ? '' : ' <span class="muted">†</span>'}</div><div class="sub">${Math.floor(P.age(w, p))} yrs · ${esc(status(p))} · 😊 ${Math.round(p.happy)} · ❤️ ${Math.round(p.health)}</div></span><span class="val">${U.fmtMoney(p.nw)}</span></div>`).join('') : '<p class="note">Nobody from your cast lives here yet. Add someone from your saved list below, or create a new person.</p>'}
      </div>
      <div class="card"><h3>Saved people <small class="muted">kept in this browser</small></h3>
        ${roster.length ? `<ul class="list-plain">${roster.map((s, i) => `<li><span><b>${esc(s.first)} ${esc(s.last)}</b> <span class="muted">${s.age} · ${esc(C.ETHNIC_NAMES[s.eth] || s.eth)} · ${esc(C.STRATEGY_NAMES[s.strategy] || '')}</span></span><span><button class="ghost" data-cast="add" data-i="${i}">Add to town</button> <button class="ghost" data-cast="edit" data-i="${i}">Edit</button> <button class="ghost" data-cast="del" data-i="${i}" title="Remove from the list">✕</button></span></li>`).join('')}</ul>` : '<p class="note">No saved people yet.</p>'}
        <div class="modal-actions"><button class="primary" data-cast="new">＋ Create a person</button><span class="spacer"></span><button class="ghost" data-cast="export">Export</button><button class="ghost" data-cast="import">Import</button><input type="file" id="cast-file" accept=".json,application/json" hidden></div>
        <div class="note">Cast members arrive by train like any newcomer and are marked ★ on the leaderboards. Click one to follow them.</div></div>`;
    el.onclick = e => {
      const b = e.target.closest('[data-cast]');
      if (!b) return;
      e.stopPropagation();
      const i = Number(b.dataset.i), list = load();
      if (b.dataset.cast === 'new') UI.openCastCreator(-1);
      else if (b.dataset.cast === 'edit') UI.openCastCreator(i);
      else if (b.dataset.cast === 'add' && list[i]) UI.addCast(list[i]);
      else if (b.dataset.cast === 'del') { list.splice(i, 1); save(list); UI.renderCast(true); }
      else if (b.dataset.cast === 'export') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(list, null, 1)], { type: 'application/json' })); a.download = 'my-cast.json'; a.click(); }
      else if (b.dataset.cast === 'import') { const f = $('cast-file'); f.onchange = async () => { try { const x = JSON.parse(await f.files[0].text()); if (Array.isArray(x)) { save(list.concat(x.filter(s => s && s.att && s.pers))); UI.renderCast(true); } } catch (err) { UI.toast('That file is not a cast list.'); } }; f.click(); }
    };
  };
})(globalThis.LES = globalThis.LES || {});
