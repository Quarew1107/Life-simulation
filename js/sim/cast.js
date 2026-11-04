// My Cast: people the user designs and drops into the town. They arrive like newcomers
// (by train) and then follow exactly the same rules as everyone else; p.custom marks them.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance;
  const Cast = LES.Cast = {};
  Cast.QUALS = [['', 'No qualification'], ['VOC', 'Vocational certificate'], ['BACH_GEN', 'Bachelor of Arts'], ['BACH_BUS', 'Bachelor of Business'], ['BACH_ENG', 'Bachelor of Engineering'], ['MED', 'Medical degree']];
  // A spec: { first, last, sex, age, eth, rel, relig, att[6], pers{}, famDesire, strategy, qual, cash, look{} }
  Cast.blank = () => ({ first: 'Aina', last: 'Rahman', sex: 'F', age: 25, eth: 'malay', rel: '', relig: 50, att: [5, 5, 5, 5, 5, 5],
    pers: { dis: 50, pat: 50, risk: 50, resp: 50, res: 50 }, famDesire: 55, strategy: 'BAL', qual: '', cash: 10000, look: { skin: '#c68642', hair: '#1b1b1b', shirt: '#2a9d8f', pants: '#1d3557', style: 1, scarf: '#c9184a' } });
  Cast.add = function (w, spec) {
    w.castN = (w.castN || 0) + 1;
    const R = new LES.RNG(`${w.cfg.seed}|cast|${w.castN}|${w.day}`);
    const eth = C.NAMES[spec.eth] ? spec.eth : 'malay';
    const p = w.makeAdult(R, { age: U.clamp(Math.round(spec.age), 18, 90), sex: spec.sex === 'M' ? 'M' : 'F', eth, migrant: true });
    p.custom = true;
    p.first = String(spec.first || p.first).slice(0, 30); p.last = String(spec.last || p.last).slice(0, 30);
    p.att = spec.att.map(v => U.clamp(Number(v) || 0, 0, 10)); p.pot = p.att.map(v => Math.max(v, U.clamp(v + 0.3, 0, 10))); p.peak = p.att.slice();
    p.attHist = [[w.day, p.att.slice()]];
    for (const k of C.PERS) p.pers[k] = Math.round(U.clamp(Number(spec.pers[k]), 0, 100));
    p.famDesire = Math.round(U.clamp(Number(spec.famDesire), 0, 100));
    if (C.STRATEGIES.includes(spec.strategy)) { p.strategy = spec.strategy; p.stratHist = [{ day: w.day, strategy: p.strategy, reason: 'your choice' }]; }
    p.quals = spec.qual ? [spec.qual] : [];
    if (p.job && !P.hasCred(p, C.JOB_BY_ID[p.job.jobId].req)) LES.Labour.endJob(w, p, 'moved town', true);
    Object.assign(p.look, spec.look || {});
    if (w.society && spec.rel) { p.rel = spec.rel; p.relig = Math.round(U.clamp(Number(spec.relig), 0, 100)); }
    const want = w.px(U.clamp(Number(spec.cash) || 0, 0, 1e9));
    if (p.cash > want) w.ledger.spend(p, 'cash', 'ABROAD', p.cash - want); else if (p.cash < want) w.ledger.pay('ABROAD', p, 'cash', want - p.cash);
    p.isHead = true;
    LES.Goals.pick(w, p, null);
    F.reviewTiers(w, p); p.mcost = F.monthlyCost(w, p); p.nw = P.netWorth(w, p); p.peakNw = p.nw;
    P.log(w, p, `Arrived in ${LES.townName(w)} (one of your cast) with ${U.fmtMoney(p.cash)}`, 'life', 2);
    w.pushFeed({ day: w.day, pid: p.id, text: `★ ${P.name(p)} (your cast) arrived in ${LES.townName(w)}`, cat: 'life', imp: 2 });
    w.stats.immigrants++;
    w.refreshLiving();
    return p;
  };
})(globalThis.LES = globalThis.LES || {});
