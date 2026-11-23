// PL-14 step 2: on a phone (760 px wide or less) the side panel is a sheet that slides up over the map.
// Three heights: 'min' (just the handle and tabs), 'half' (the default) and 'full'. Tap the handle to switch
// between half and full, drag it up or down, or tap a tab when the sheet is down. An important decision
// waiting opens the sheet at least halfway. The choice is remembered on this device only.
(function (LES) {
  'use strict';
  const UI = LES.UI = LES.UI || {};
  const KEY = 'les-sheet', STATES = ['min', 'half', 'full'];
  const phone = () => window.matchMedia('(max-width: 760px)').matches;
  let state = 'half';
  try { const s = localStorage.getItem(KEY); if (STATES.includes(s)) state = s; } catch (e) { /* private window: default */ }

  function apply() {
    const b = document.body;
    for (const s of STATES) b.classList.toggle(`sheet-${s}`, s === state);
    const g = document.getElementById('sheet-grip');
    if (g) {
      g.setAttribute('aria-expanded', state === 'min' ? 'false' : 'true');
      g.setAttribute('aria-label', LES.I18n ? LES.I18n.t(state === 'full' ? 'ui.sheet.lower' : 'ui.sheet.raise') : '');
    }
  }
  window.addEventListener('les-lang', () => apply()); // the handle's label in the new language (PL-17)
  UI.sheet = {
    get: () => state,
    set(s) { if (!STATES.includes(s) || s === state) return; state = s; try { localStorage.setItem(KEY, s); } catch (e) { /* ignore */ } apply(); },
    // At least this open (used when a decision waits); never lowers it.
    atLeast(s) { if (phone() && STATES.indexOf(state) < STATES.indexOf(s)) UI.sheet.set(s); },
  };

  function init() {
    const side = document.getElementById('side');
    if (!side || document.getElementById('sheet-grip')) return;
    const g = document.createElement('button');
    g.id = 'sheet-grip'; g.type = 'button'; g.className = 'sheet-grip';
    g.innerHTML = '<span></span>';
    side.insertBefore(g, side.firstChild);
    apply();
    // Tap: half <-> full (min -> half). Drag: up raises, down lowers, one step per drag.
    let y0 = null, moved = false;
    g.addEventListener('pointerdown', e => { y0 = e.clientY; moved = false; g.setPointerCapture(e.pointerId); });
    g.addEventListener('pointermove', e => { if (y0 !== null && Math.abs(e.clientY - y0) > 12) moved = true; });
    g.addEventListener('pointerup', e => {
      if (y0 === null) return;
      const dy = e.clientY - y0, i = STATES.indexOf(state); y0 = null;
      if (!moved) UI.sheet.set(state === 'half' ? 'full' : 'half');
      else if (dy < -40) UI.sheet.set(STATES[Math.min(2, i + 1)]);
      else if (dy > 40) UI.sheet.set(STATES[Math.max(0, i - 1)]);
    });
    g.addEventListener('pointercancel', () => { y0 = null; });
    g.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); UI.sheet.set(STATES[Math.min(2, STATES.indexOf(state) + 1)]); }
      if (e.key === 'ArrowDown') { e.preventDefault(); UI.sheet.set(STATES[Math.max(0, STATES.indexOf(state) - 1)]); }
    });
    // A tab tapped while the sheet is down opens it halfway.
    const tabs = document.getElementById('tabs');
    if (tabs) tabs.addEventListener('click', () => { if (state === 'min') UI.sheet.set('half'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(globalThis.LES = globalThis.LES || {});
