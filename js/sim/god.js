// Sandbox interventions (C09b): one state-changing God Mode action, Fate, which ends one person's life through the
// normal World.die (guardians, the estate, business succession, the family tree all follow as for any death).
// A request becomes an immutable command { id, kind, target, requestedDay, status } in w.intervention.pending and
// is carried out at the start of the next simulation step (never mid-step), exactly once, also across save/load.
// The world is then marked as intervened: its report and statistics say so, and Fate deaths are kept out of
// natural mortality. Spectator tools (js/ui/spectator.js) never come here.
(function (LES) {
  'use strict';
  const G = LES.God = {};
  const state = w => (w.intervention = w.intervention || { modified: false, nextId: 1, pending: [], events: [] });
  G.intervened = w => !!(w && w.intervention && w.intervention.modified);

  // Who would be affected (for the confirmation window): children in their care, partner, businesses they run.
  G.impact = function (w, p) {
    const kids = p.careOf.map(id => w.people[id]).filter(c => c && c.alive && !c.adult);
    return {
      kids: kids.length, heirs: p.children.filter(id => w.people[id] && w.people[id].alive).length, soleCarer: kids.filter(c => c.caregivers.length <= 1).length, partner: p.partnerId !== null ? w.people[p.partnerId] : null,
      runs: p.manages >= 0 && w.biz[p.manages] ? w.biz[p.manages].name : null, stakes: Object.keys(p.shares).length, job: p.job ? p.job.title : null,
    };
  };
  // Where a request must go: a person living in a sister town is acted on there; abroad cannot be reached.
  G.resolve = function (w, id) {
    const p = w.people[id];
    if (!p) return { error: 'No such person.' };
    if (!p.alive) return { error: `${LES.P.name(p)} has already died.` };
    if (p.away) {
      const where = LES.Region && LES.Region.where ? LES.Region.where(w, p) : null;
      if (!where) return { error: `${LES.P.name(p)} lives outside the region: out of reach.` };
      const q = where.w.people[where.id];
      return q && q.alive ? { w: where.w, p: q } : { error: 'That person is no longer alive.' };
    }
    return { w, p };
  };
  // Queue Fate for a person (after the user confirmed). Returns { command } or { error }.
  G.requestFate = function (w, id) {
    const r = G.resolve(w, id);
    if (r.error) return r;
    const st = state(r.w);
    if (st.pending.some(c => c.kind === 'FATE' && c.target === r.p.id)) return { error: 'Fate is already on its way for this person.' };
    const command = { id: `${r.w.townIdx || 0}-${st.nextId++}`, kind: 'FATE', target: r.p.id, requestedDay: r.w.day, status: 'pending' };
    st.pending.push(command);
    return { command, w: r.w };
  };
  // Called at the start of World.step: carry out queued commands once, re-checking each target.
  G.apply = function (w) {
    const st = w.intervention, todo = st.pending.splice(0);
    for (const c of todo) {
      const p = w.people[c.target];
      if (!p || !p.alive || p.away) { c.status = 'skipped'; c.reason = !p ? 'no such person' : !p.alive ? 'already dead' : 'moved away'; }
      else {
        p.fate = c.id; // kept out of natural mortality (Calibration)
        w.pushFeed({ day: w.day, pid: p.id, text: `${LES.P.name(p)} was taken by Fate (a sandbox intervention)`, cat: 'life', imp: 2 });
        w.die(p, 'Fate (sandbox intervention)');
        c.status = 'applied';
        st.modified = true;
      }
      c.day = w.day; c.rulesRev = w.cfg.rulesRev;
      st.events.push(c);
      if (st.events.length > 200) st.events.shift();
    }
  };
})(globalThis.LES = globalThis.LES || {});
