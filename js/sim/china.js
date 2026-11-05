// China's own rules (country pack 'cn'; inert elsewhere). A plug-in system plus helpers the fiscal,
// labour and world code call when the pack has them:
// - Hukou (household registration): every person is local urban, local rural or from outside. Founders
//   follow the city's mix, newcomers hold a hukou elsewhere, children take a parent's. People switch to a
//   local urban hukou after years of social insurance, with a degree or on buying a home in a new estate.
//   Outside hukou: no dibao, insured at home (lower refunds), children's school costs, gaokao at home.
// - Social insurance cover of jobs (many migrant jobs have none) and the earnings record behind the
//   employees' basic pension; the residents' pension for everyone else.
// - The retirement age under the 2025 reform; the zhongkao that sends ~45% of pupils to vocational schools.
// No dice are rolled here: fixed per-person hashes keep other random streams untouched.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P;
  const CN = LES.China = {};
  const pack = () => LES.Countries.pack;
  CN.on = () => !!pack().hukou;
  const hash = (id, k) => ((id * 2654435761 + k * 40503) >>> 0) % 1000 / 1000;
  CN.hash = hash;
  CN.calYear = day => 2026 + day / 365; // Year 1 is 2026

  // ---- Hukou ----
  CN.assign = function (w, p) {
    if (p.migrant) return 'outside';
    const m = pack().hukou.mix, r = hash(p.id, 11);
    return r < m.urban ? 'urban' : r < m.urban + m.rural ? 'rural' : 'outside';
  };
  CN.inherit = function (w, c) {
    const ps = c.parents.map(id => w.people[id]).filter(q => q && q.hukou);
    if (ps.some(q => q.hukou === 'urban')) return 'urban';
    const m = ps.find(q => q.sex === 'F') || ps[0];
    return m ? m.hukou : 'urban';
  };
  // Starting wealth multiplier by hukou (the founders' average stays the same).
  CN.wealthGap = function (p) {
    const H = pack().hukou, SW = H.startWealth, norm = Object.keys(H.mix).reduce((s, k) => s + H.mix[k] * SW[k], 0);
    return SW[p.hukou] / norm;
  };
  CN.name = h => (pack().hukou.names || {})[h] || h;

  // ---- Social insurance ----
  // Is this job paying social insurance? Public jobs always; others by hukou (fixed per person and job).
  CN.covered = function (w, p, job) {
    if (LES.Services.lineOf(job)) return true;
    const cov = pack().hukou.coverage[p.hukou || 'urban'];
    return hash(p.id + (job.startDay | 0), 7) < cov;
  };
  // The record of someone who worked before joining the city (founders and newcomers): years from 22 at a
  // typical wage, covered for part of them. People born here start at zero.
  function init(w, p) {
    const PN = pack().welfare.pension, age = P.age(w, p), yrs = p.gen === 0 || p.migrant ? Math.max(0, Math.min(age, CN.retireAge(w, p)) - 22) : 0;
    const share = hash(p.id, 13) < pack().hukou.coverage[p.hukou || 'urban'] ? 0.8 : 0.15;
    const wage = Math.max(p.incomeEMA || 0, p.job ? p.job.salary : 0) / w.price / 100;
    const idx = U.clamp(wage / PN.avgWage || 0.6, 0.6, 3);
    p.siMonths = Math.round(yrs * 12 * share); p.siIdx = p.siMonths * idx; p.siAcct = p.siMonths * idx * PN.avgWage * PN.personal;
  }
  CN.contribute = function (w, p, gross) {
    if (p.siMonths === undefined) init(w, p);
    const PN = pack().welfare.pension, idx = U.clamp(gross / w.price / 100 / PN.avgWage, 0.6, 3);
    p.siMonths++; p.siIdx += idx; p.siAcct += idx * PN.avgWage * PN.personal;
  };

  // ---- Retirement age (2025 reform): the base age plus one month for every `step` months a person
  // reaches it after January 2025, up to the new age. Blue-collar women follow the workers' rule.
  CN.retireAge = function (w, p) {
    const PN = pack().welfare.pension;
    if (p.sex === 'F' && p.cnWorker === undefined && p.job) p.cnWorker = PN.workerJobs.includes(p.job.jobId);
    const [base, top, step] = p.sex === 'M' ? PN.men : p.cnWorker ? PN.womenWorkers : PN.women;
    const born = CN.calYear(w.day) - P.age(w, p), reach = born + base; // calendar year the base age is reached
    if (reach < PN.startYear) return base;
    return Math.min(top, base + (Math.floor((reach - PN.startYear) * 12 / step + 1e-9) + 1) / 12); // (born Jan-Apr 1965: 60 and 1 month)
  };
  CN.minYears = function (w) { // 15 years, rising by half a year a year from 2030 to 20
    const PN = pack().welfare.pension, y = Math.floor(CN.calYear(w.day));
    return y < PN.minYearsFrom ? PN.minYears : Math.min(PN.minYearsTo, PN.minYears + 0.5 * (y - PN.minYearsFrom + 1));
  };
  // The monthly pension (Year-1 money) claimed at retirement.
  CN.claim = function (w, p) {
    if (p.siMonths === undefined) init(w, p);
    const PN = pack().welfare.pension, yrs = p.siMonths / 12, age = Math.floor(P.age(w, p));
    if (yrs < CN.minYears(w)) { p.cnPension = PN.resident; p.cnEmp = false; return; }
    const idx = p.siMonths ? p.siIdx / p.siMonths : 0.6;
    const ages = Object.keys(PN.divisor).map(Number).filter(a => a <= age), div = PN.divisor[ages.length ? Math.max(...ages) : 50];
    p.cnPension = PN.avgWage * (1 + idx) / 2 * yrs * 0.01 + p.siAcct / div;
    p.cnEmp = true;
  };

  // ---- Exams: university entry is harder from a vocational school, and for migrants who must sit
  // the gaokao in the province of their hukou.
  CN.examBar = function (w, p, course) {
    const G = pack().education && pack().education.gaokao;
    if (!G || course.id === 'VOC' || course.id === 'MASTER') return 0;
    return (p.zk === 'vocational' ? G.vocationalBar : 0) + (p.hukou === 'outside' && P.age(w, p) < 25 ? G.awayBar : 0);
  };

  function convert(w, p, why) {
    p.hukou = 'urban';
    P.log(w, p, `Got a local urban hukou (${why})`, 'life', 1);
    for (const id of p.careOf) { const c = w.people[id]; if (c.alive && !c.adult) c.hukou = 'urban'; }
  }

  LES.Systems.register({
    id: 'china', order: 25,
    enabled: cfg => cfg.country === 'cn',
    personCreated(w, p, how) { if (how === 'child' && CN.on()) p.hukou = CN.inherit(w, p); },
    year(w) {
      if (!CN.on()) return;
      const H = pack().hukou, G = pack().education && pack().education.gaokao;
      for (const p of w.living) { // hukou transfers
        if (!p.alive || !p.adult || p.away || !p.hukou || p.hukou === 'urban' || hash(p.id, 19) >= H.convert.willing) continue;
        if ((p.siMonths || 0) >= H.convert.siYears * 12 && p.job) convert(w, p, `${H.convert.siYears} years of social insurance`);
        else if (p.quals.some(P.isBachelor)) convert(w, p, 'a degree');
        else if (p.tiers && p.tiers.housing >= H.convert.homeTier) convert(w, p, 'bought a home');
      }
      if (G) { // the zhongkao: the top share of the year's 15-year-olds go to academic high schools
        const kids = w.living.filter(c => c.alive && !c.adult && c.zk === undefined && P.age(w, c) >= G.zhongkaoAge);
        const score = c => c.att[LES.C.INT] + 0.8 * ((c.schoolQ || 1) - 1) + 2 * hash(c.id, 17);
        kids.sort((a, b) => score(b) - score(a) || a.id - b.id);
        const n = Math.round(kids.length * G.academic);
        kids.forEach((c, i) => { c.zk = i < n ? 'academic' : 'vocational'; });
      }
    },
    hash(w, parts) { let u = 0, r = 0, o = 0; for (const p of w.living) { if (p.hukou === 'urban') u++; else if (p.hukou === 'rural') r++; else if (p.hukou === 'outside') o++; } parts.push(`hk${u}.${r}.${o}`); },
  });
})(globalThis.LES = globalThis.LES || {});
