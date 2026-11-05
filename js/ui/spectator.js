// Spectator tools (C09a): Spotlight, Bookmarks (a person or a whole family) and Celebrate. They only READ the
// world: no simulation state, random numbers, money or life events are touched. Their own state lives here and
// bookmarks are kept in the browser per world seed (localStorage), never in the world or its save. Follow is the
// renderer's existing camera follow.
(function (LES) {
  'use strict';
  const SP = LES.Spectator = { spotlight: -1, marks: [], seedKey: '', bursts: [] };
  const KEY = w => `les-bookmarks:${w.cfg.country || 'my'}:${w.cfg.seed}`;
  const store = () => { try { if (typeof localStorage !== 'undefined' && SP.seedKey) localStorage.setItem(SP.seedKey, JSON.stringify(SP.marks)); } catch (e) { /* private window: memory only */ } };
  // Load this world's bookmarks the first time it is shown.
  SP.sync = function (w) {
    const k = KEY(w);
    if (SP.seedKey === k) return;
    if (SP.seedKey) { SP.spotlight = -1; SP.bursts = []; } // (another world: its spotlight and confetti go)
    SP.seedKey = k; SP.marks = [];
    try { const v = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(k) || '[]') : []; if (Array.isArray(v)) SP.marks = v.filter(m => Number.isInteger(m.id)); } catch (e) { SP.marks = []; }
  };
  SP.mark = id => SP.marks.find(m => m.id === id) || null;
  // Bookmark a person, or the person and their family (partner, parents, children); a second click removes it.
  SP.toggleBookmark = function (w, id, family) {
    SP.sync(w);
    const m = SP.mark(id);
    if (m && !!m.family === !!family) SP.marks = SP.marks.filter(x => x !== m);
    else if (m) m.family = !!family;
    else SP.marks.push({ id, family: !!family, day: w.day });
    store();
    return !!SP.mark(id);
  };
  SP.familyOf = function (w, p) {
    const ids = new Set([p.id]);
    if (p.partnerId !== null) ids.add(p.partnerId);
    for (const id of p.parents) ids.add(id);
    for (const id of p.children) ids.add(id);
    return [...ids].filter(id => w.people[id]);
  };
  // Everyone to mark on the map: bookmarked people, plus family members of family bookmarks.
  SP.marked = function (w) {
    SP.sync(w);
    const out = new Map();
    for (const m of SP.marks) {
      const p = w.people[m.id];
      if (!p) continue;
      out.set(p.id, 'person');
      if (m.family) for (const id of SP.familyOf(w, p)) if (!out.has(id)) out.set(id, 'family');
    }
    return out;
  };
  SP.toggleSpotlight = id => { SP.spotlight = SP.spotlight === id ? -1 : id; return SP.spotlight; };
  SP.celebrate = id => { SP.bursts.push({ id, t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()) }); if (SP.bursts.length > 20) SP.bursts.shift(); };

  // Drawn by the renderer in screen space after its labels (reads screen positions only).
  SP.draw = function (r, g, w) {
    SP.sync(w);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now(), pos = id => r.screenPos.find(q => q.id === id);
    if (SP.spotlight >= 0) {
      const s = pos(SP.spotlight), W = r.vw, H = r.vh;
      if (s) {
        const rad = Math.max(40, 26 * r.z), grd = g.createRadialGradient(s.x, s.y, rad * 0.6, s.x, s.y, rad * 2.2);
        grd.addColorStop(0, 'rgba(10,12,18,0)'); grd.addColorStop(1, 'rgba(10,12,18,0.55)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.arc(s.x, s.y, rad * 0.6, 0, Math.PI * 2); g.stroke();
      }
    }
    for (const [id, kind] of SP.marked(w)) {
      const s = pos(id);
      if (!s) continue;
      const y = s.y - 10 * r.z - 26;
      g.fillStyle = kind === 'person' ? '#ff8c42' : 'rgba(255,140,66,0.65)';
      g.beginPath(); g.moveTo(s.x - 4, y); g.lineTo(s.x + 4, y); g.lineTo(s.x + 4, y + 9); g.lineTo(s.x, y + 6); g.lineTo(s.x - 4, y + 9); g.closePath(); g.fill(); // a bookmark ribbon
    }
    SP.bursts = SP.bursts.filter(b => now - b.t0 < 2200);
    const COL = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#f4f1e8'];
    for (const b of SP.bursts) {
      const s = pos(b.id);
      if (!s) continue;
      const t = (now - b.t0) / 1000;
      for (let i = 0; i < 36; i++) { // fixed pattern per piece: no random numbers at all
        const a = i * 2.39996, v = 60 + (i % 7) * 14, x = s.x + Math.cos(a) * v * t, y = s.y - 10 * r.z + Math.sin(a) * v * t - 70 * t + 120 * t * t;
        g.globalAlpha = Math.max(0, 1 - t / 2.2); g.fillStyle = COL[i % COL.length]; g.fillRect(x, y, 4, 3);
      }
      g.globalAlpha = 1;
    }
  };
})(globalThis.LES = globalThis.LES || {});
