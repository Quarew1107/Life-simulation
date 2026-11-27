// Play a Life, plan part 6 (Nov 2026): a played president proposes law changes to the council.
// - PROPOSE_LAW { key, v }: the change goes to the treasurer, the police chief and the community development
//   director, exactly as any president's (Gov.propose: their politics, their job, loyalty, caution, your
//   popularity, chance); at least as many yes as no passes it. The journal lists each vote and its main reason.
// - MEET_OFFICIAL { role }: a meeting before you propose; if they are won over (charisma, standing and traits
//   help), they lean towards your next proposals for 60 days.
// - Pl.lawLean: what each official would probably say, for the Community page (likely yes / undecided / likely no).
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  Pl.isPresident = (w, p) => !!(w.gov && p && w.gov.president === p.id);
  const GV = () => LES.Gov;
  Pl.lawLean = function (w, key, v) {
    const g = w.gov, ts = GV().townStats ? GV().townStats(w) : null;
    return LES.Council.ORDER.map(role => {
      const o = g.officials && g.officials[role];
      if (!o) return { role, lean: 'vacant' };
      const s = GV().councilLean(w, role, o, key, v, 'player', ts).score;
      return { role, name: LES.Council.name(w, o), lean: s > 0.35 ? 'yes' : s < -0.35 ? 'no' : 'maybe' };
    });
  };
  Object.assign(Pl.HANDLERS, {
    PROPOSE_LAW: {
      hours: 2, cooldown: 30, adult: true, key: a => `law:${a.key}`,
      check(w, p, a) {
        if (!Pl.isPresident(w, p)) return 'not_president';
        const law = GV().LAW_BY_KEY[a.key];
        if (!law || !GV().lawsFor(w).includes(law) || !law.options.some(o => String(o[0]) === String(a.v))) return 'bad_args';
        if (w.gov.frozen) return 'frozen';
        return String(w.gov.laws[a.key]) === String(a.v) ? 'same' : null;
      },
      params(w, p, a) { const law = GV().LAW_BY_KEY[a.key]; return { what: law ? law.name : a.key, item: law ? GV().optName(a.key, law.options.find(o => String(o[0]) === String(a.v))[0]) : a.v }; },
      run(w, p, a) {
        const law = GV().LAW_BY_KEY[a.key], v = law.options.find(o => String(o[0]) === String(a.v))[0], params = { what: law.name, item: GV().optName(a.key, v) };
        const r = GV().propose(w, a.key, v, 'player');
        st(w).played = true;
        for (const x of r.votes || []) Pl.journal(w, { kind: 'life', key: 'vote.line', params: { role: LES.Council.ROLES[x.role].en, name: x.name, vote: { key: x.yes ? 'vote.yes' : 'vote.no' }, why: { key: `vote.r.${x.reason}` } }, imp: 1 });
        if (r.pass) { st(w).rep = U.clamp((st(w).rep === undefined ? 50 : st(w).rep) + 1, 0, 100); return { code: 'passed', params: Object.assign(params, { yes: r.yes || 0, no: r.no || 0 }) }; }
        return { code: 'rejected', params: Object.assign(params, { yes: r.yes, no: r.no }) };
      },
    },
    MEET_OFFICIAL: {
      hours: 3, cooldown: 30, adult: true, key: a => `meetoff:${a.role}`,
      check(w, p, a) { return !Pl.isPresident(w, p) ? 'not_president' : !(w.gov.officials && w.gov.officials[a.role]) ? 'vacant' : null; },
      params(w, p, a) { const o = w.gov.officials && w.gov.officials[a.role]; return { role: LES.Council.ROLES[a.role] ? LES.Council.ROLES[a.role].en : a.role, name: o ? LES.Council.name(w, o) : '' }; },
      run(w, p, a) {
        const o = w.gov.officials[a.role], q = o.id >= 0 ? w.people[o.id] : null, R = Pl.rng(w), s = st(w), name = LES.Council.name(w, o);
        s.played = true;
        const yes = U.clamp(0.45 + 0.05 * (p.att[C.CHA] - 5) + Pl.traitOdds(w, p, 'ASK_RAISE') - (q ? 0.2 * Math.max(0, (q.pers.resp - 50) / 50) : 0), 0.15, 0.9);
        if (R.next() >= yes) return { code: 'refused', params: { name } };
        (s.persuaded = s.persuaded || {})[a.role] = w.day;
        return { code: 'ok', params: { name } };
      },
    },
  });
})(globalThis.LES = globalThis.LES || {});
