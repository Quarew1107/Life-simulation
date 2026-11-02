// Batch-5 extras: interactive family tree, compare two people, map overlays and
// generated chiptune music / sound effects (Web Audio, muted by default).
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, UI = LES.UI;
  const esc = U.esc;
  const X = LES.Extras = {};

  // ---------------- Family tree (SVG, clickable) ----------------
  X.familyTreeSvg = function (w, p) {
    const rows = [];
    const gp = [];
    for (const pid of p.parents) for (const g of w.people[pid].parents) if (!gp.includes(g)) gp.push(g);
    if (gp.length) rows.push({ label: 'Grandparents', ids: gp });
    if (p.parents.length) rows.push({ label: 'Parents', ids: p.parents.slice() });
    const partners = [p.partnerId, ...p.exPartners].filter((x, i, a) => x !== null && a.indexOf(x) === i);
    rows.push({ label: 'Self & partners', ids: [p.id, ...partners], self: p.id });
    if (p.children.length) rows.push({ label: 'Children', ids: p.children.slice() });
    const gc = p.children.flatMap(c => w.people[c].children);
    if (gc.length) rows.push({ label: 'Grandchildren', ids: gc });
    const W = 400, rowH = 64, nodeW = 84, nodeH = 34;
    const pos = new Map();
    rows.forEach((row, r) => {
      const ids = row.ids.slice(0, 8);
      const gap = Math.min(nodeW + 8, (W - 20) / Math.max(1, ids.length));
      const x0 = W / 2 - gap * (ids.length - 1) / 2;
      ids.forEach((id, i) => pos.set(id, { x: x0 + i * gap, y: 22 + r * rowH, row: r }));
      row.more = row.ids.length - ids.length;
    });
    const H = rows.length * rowH + 10;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="ftree" role="img" aria-label="Family tree">`;
    // Lines: each child to each parent present in the tree
    for (const [id, a] of pos) {
      for (const par of w.people[id].parents) {
        const b = pos.get(par);
        if (b && b.row < a.row) svg += `<path d="M${a.x} ${a.y - nodeH / 2} C${a.x} ${a.y - rowH / 2}, ${b.x} ${b.y + rowH / 2}, ${b.x} ${b.y + nodeH / 2}" stroke="#4a5868" fill="none"/>`;
      }
    }
    rows.forEach((row, r) => {
      svg += `<text x="4" y="${22 + r * rowH - nodeH / 2 - 4}" font-size="8" fill="#8c9aab">${row.label}${row.more ? ` (+${row.more})` : ''}</text>`;
    });
    for (const [id, a] of pos) {
      const q = w.people[id];
      const col = C.STRATEGY_COLORS[q.strategy];
      const self = id === p.id;
      svg += `<g class="fnode" data-pid="${id}" transform="translate(${a.x - nodeW / 2},${a.y - nodeH / 2})">
        <rect width="${nodeW}" height="${nodeH}" rx="5" fill="${self ? '#1d3a3a' : '#1c252f'}" stroke="${self ? '#3ec7b5' : col}" stroke-width="${self ? 2 : 1}" ${q.alive ? '' : 'stroke-dasharray="3 2" opacity="0.7"'}/>
        <text x="${nodeW / 2}" y="13" text-anchor="middle" font-size="9" fill="#e8edf2">${esc(q.first.slice(0, 13))}${q.alive ? '' : ' †'}</text>
        <text x="${nodeW / 2}" y="26" text-anchor="middle" font-size="8" fill="#8c9aab">${Math.floor(P.age(w, q))}y · ${esc(U.fmtMoney(q.alive ? q.nw : q.peakNw))}</text></g>`;
    }
    return svg + '</svg>';
  };

  // Living descendants and their combined wealth (a "dynasty").
  X.dynasty = function (w, p) {
    const seen = new Set(), stack = [...p.children];
    let n = 0, wealth = 0;
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const q = w.people[id];
      if (q.alive) { n++; wealth += Math.max(0, q.nw); }
      stack.push(...q.children);
    }
    return { total: seen.size, living: n, wealth };
  };

  // ---------------- Compare two people ----------------
  X.compareHtml = function (w, a, b) {
    const row = (label, f) => `<tr><td class="muted">${label}</td><td>${f(a)}</td><td>${f(b)}</td></tr>`;
    const better = (x, y) => (x > y ? 'pos' : x < y ? 'neg' : '');
    const num = (label, f, fmt) => `<tr><td class="muted">${label}</td><td class="${better(f(a), f(b))}">${fmt(f(a))}</td><td class="${better(f(b), f(a))}">${fmt(f(b))}</td></tr>`;
    return `<div class="card compare"><h3>Compare <small><button class="ghost" data-act="unpin">Stop comparing</button></small></h3>
      <table class="cmp"><tr><th></th><th>${UI.plink(w, a.id)}</th><th>${UI.plink(w, b.id)}</th></tr>
      ${row('Age', q => Math.floor(P.age(w, q)))}
      ${row('Strategy', q => C.STRATEGY_NAMES[q.strategy])}
      ${row('Qualifications', q => esc(q.quals.map(x => C.QUALS[x]).join(', ') || 'None'))}
      ${num('Net worth', q => q.nw, U.fmtMoney)}
      ${num('Peak net worth', q => q.peakNw, U.fmtMoney)}
      ${num('Wages earned', q => q.earned.wages, U.fmtMoney)}
      ${num('Business payouts', q => q.earned.business, U.fmtMoney)}
      ${num('Inherited', q => q.earned.inherit + q.earned.gifts, U.fmtMoney)}
      ${C.ATTR_NAMES.map((n, i) => num(n, q => q.att[i], v => v.toFixed(1))).join('')}
      ${C.PERS.map(k => num(C.PERS_NAMES[k], q => q.pers[k], v => v)).join('')}
      ${num('Children', q => q.children.length, v => v)}
      ${num('Businesses founded', q => w.biz.filter(x => x.founderId === q.id).length, v => v)}</table></div>`;
  };

  // ---------------- Map overlays ----------------
  X.OVERLAYS = [['none', 'No overlay'], ['wealth', 'Wealth'], ['strategy', 'Strategy'], ['stress', 'Stress'], ['family', "Selected person's family"]];
  X.overlayColour = function (w, p, mode, selected) {
    if (mode === 'wealth') {
      const v = U.clamp((Math.log10(Math.max(1, P.realWorth(w, p) / 100)) - 3) / 5, 0, 1); // RM1k..RM100M
      return `hsl(${Math.round(v * 50)}, 90%, ${45 + v * 15}%)`;
    }
    if (mode === 'strategy') return C.STRATEGY_COLORS[p.strategy];
    if (mode === 'stress') return `hsl(${Math.round(120 - p.stress * 1.2)}, 80%, 50%)`;
    if (mode === 'family' && selected) {
      if (p.id === selected.id) return '#3ec7b5';
      const rel = selected.parents.includes(p.id) || selected.children.includes(p.id) || p.parents.some(x => selected.parents.includes(x)) || selected.partnerId === p.id;
      return rel ? '#f2c14e' : null;
    }
    return null;
  };

  // ---------------- Chiptune music & sound effects ----------------
  const S = X.sound = { on: false, ctx: null, next: 0, step: 0, master: null };
  const SCALES = { growth: [0, 2, 4, 7, 9, 12, 14], normal: [0, 2, 4, 5, 7, 9, 12], recession: [0, 2, 3, 5, 7, 8, 12] };
  function tone(freq, t, dur, type, vol) {
    const o = S.ctx.createOscillator(), g = S.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(S.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  X.toggleSound = function () {
    S.on = !S.on;
    if (S.on && !S.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { S.on = false; return false; }
      S.ctx = new AC();
      S.master = S.ctx.createGain();
      S.master.gain.value = 0.18;
      S.master.connect(S.ctx.destination);
    }
    if (S.ctx) { if (S.on) S.ctx.resume(); else S.ctx.suspend(); }
    S.next = S.ctx ? S.ctx.currentTime + 0.1 : 0;
    return S.on;
  };
  // Called every frame: schedules the next few notes of a generated melody.
  X.soundTick = function (w, paused) {
    if (!S.on || !S.ctx || paused) return;
    const regime = w.regime, scale = SCALES[regime];
    const tempo = regime === 'growth' ? 0.16 : regime === 'recession' ? 0.24 : 0.2;
    const root = regime === 'recession' ? 196 : 220;
    while (S.next < S.ctx.currentTime + 0.3) {
      const i = S.step++;
      const seed = (Math.floor(i / 16) * 7919 + (i % 16) * 104729) >>> 0;
      const deg = scale[(seed >>> 3) % scale.length];
      if (i % 2 === 0 || seed % 5 === 0) tone(root * Math.pow(2, deg / 12), S.next, tempo * 0.9, 'square', 0.12);
      if (i % 4 === 0) tone(root / 2 * Math.pow(2, scale[(i / 4) % 3 === 0 ? 0 : 4] / 12), S.next, tempo * 3.5, 'triangle', 0.2);
      if (i % 8 === 4) tone(80, S.next, 0.05, 'square', 0.08);
      S.next += tempo;
    }
  };
  X.sfx = function (kind) {
    if (!S.on || !S.ctx) return;
    const t = S.ctx.currentTime + 0.02;
    const seq = { milestone: [523, 659, 784, 1047], goal: [523, 659, 784, 1047, 1319, 1568], birth: [880, 1175], bad: [330, 247, 196] }[kind] || [660];
    seq.forEach((f, i) => tone(f, t + i * 0.09, 0.12, 'square', 0.15));
  };
})(globalThis.LES = globalThis.LES || {});
