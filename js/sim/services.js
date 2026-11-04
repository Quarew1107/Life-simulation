// Public and private services (part of the government system; inert without it).
//
// - Public servants: police officers, teachers, nurses and doctors work for the town.
//   The treasury pays their wages, and the laws set how many posts there are
//   (officers / teachers / health staff per 1,000 residents). With the government on,
//   the random job market no longer opens teacher, nurse or doctor posts; the town
//   posts them itself, and private schools and hospitals post their own.
// - Service quality: staff per resident compared with the Malaysian norm gives an
//   education quality (children's learning) and a health quality (mortality, recovery).
// - Private services: residents can open a private clinic (doctors only, in a shoplot),
//   a private school or a private hospital (built on an empty lot). The owner pays the
//   staff. Richer families may send children to the private school (monthly fees go to
//   the school), and richer patients may use the private hospital or clinic.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const SV = LES.Services = {};

  // Public posts: job, law that sets them, building, budget line.
  // per1000: Malaysian ratios (MOE ~420k teachers; MOH ~3.5 nurses and ~1.5 doctors per
  // 1,000 in the public sector; PDRM ~4 officers per 1,000).
  SV.POSTS = {
    police: { job: 'police', place: 'police', line: 'police' },
    teacher: { job: 'teacher', place: 'school', line: 'education' },
    nurse: { job: 'nurse', place: 'hospital', line: 'health' },
    doctor: { job: 'doctor', place: 'hospital', line: 'health' },
  };
  SV.SCHOOLS = { lean: 9, malaysia: 12, generous: 16 };        // teachers per 1,000 residents
  SV.HEALTH = { lean: [2.5, 1], malaysia: [3.5, 1.5], generous: [5, 2.2] }; // nurses, doctors per 1,000
  SV.PUBLIC_JOBS = new Set(['teacher', 'nurse', 'doctor']);
  SV.PRIVATE_FEE_SHARE = 0.12; // families pay private-school fees only below this share of income
  SV.PRIVATE_SEATS = 15;       // pupils per private-school teacher

  // Which budget line pays this job (null = a private employer).
  SV.lineOf = function (job) {
    if (!job || job.biz >= 0) return null;
    const id = job.jobId;
    if (id === 'police') return 'police';
    if (id === 'teacher') return 'education';
    if (id === 'nurse' || id === 'doctor') return 'health';
    if (id === 'treasurer' || id === 'community') return 'council';
    return null;
  };

  SV.targets = function (w, pop) {
    const pol = w.policy, af = w.gov.afford || 1, k = pop / 1000;
    const hs = SV.HEALTH[pol.health] || SV.HEALTH.malaysia;
    const n = (per, min) => Math.max(min, Math.round(per * k * af));
    return { police: n(pol.policePer1000, 1), teacher: n(SV.SCHOOLS[pol.schools] || 12, 1), nurse: n(hs[0], 1), doctor: n(hs[1], pop >= 150 ? 1 : 0) };
  };

  const staffOf = (w, jobId, bizId) => w.living.filter(p => p.alive && p.job && p.job.jobId === jobId && (bizId === undefined ? !(p.job.biz >= 0) : p.job.biz === bizId));
  function placeFor(w, kind) {
    const t = w.town;
    if (t.kinds[kind] && t.kinds[kind].length) return t.kinds[kind][0];
    if (kind === 'police') return t.byKind.depot !== undefined ? t.byKind.depot : t.byKind.hall;
    return t.byKind[kind] !== undefined ? t.byKind[kind] : t.byKind.hall;
  }
  function post(w, job, salary, place, extra) {
    const v = { id: w.nextVacId++, job, salary, openDay: w.day, closeDay: w.day + 20, applicants: [], appSet: new Set(), place };
    if (extra) Object.assign(v, extra);
    w.vacancies.push(v);
  }

  // Public posts follow the laws (and the budget: a hiring freeze when money is short).
  SV.staffMonth = function (w, ts) {
    const g = w.gov, tg = SV.targets(w, ts.pop);
    let posted = 0;
    g.staff = {};
    for (const key of Object.keys(SV.POSTS)) {
      const d = SV.POSTS[key], j = C.JOB_BY_ID[d.job];
      const staff = staffOf(w, d.job);
      const open = w.vacancies.filter(v => v.job.id === d.job && !(v.biz >= 0)).length;
      const list = key !== 'police' && w.town.kinds[d.place] && w.town.kinds[d.place].length ? w.town.kinds[d.place] : null;
      for (let k = staff.length + open; k < tg[key]; k++, posted++) {
        post(w, j, Math.round(w.px(j.salary) / 1000) * 1000, list ? list[k % list.length] : placeFor(w, d.place));
      }
      if (staff.length > tg[key]) { // posts cut: the newest go
        staff.sort((a, b) => b.job.startDay - a.job.startDay || b.id - a.id);
        for (const p of staff.slice(0, staff.length - tg[key])) { if (p.id === (g.officials && g.officials.police)) continue; LES.Labour.endJob(w, p, 'laid off'); }
      }
      g.staff[key] = { have: Math.min(staff.length, tg[key]), target: tg[key] };
    }
    // Private employers top up their own staff.
    for (const b of w.biz) {
      if (!b.open || !b.typeDef.staff) continue;
      const size = Math.sqrt(Math.max(0.3, b.scale / U.RM(b.typeDef.scale0)));
      for (const [jobId, base] of Object.entries(b.typeDef.staff)) {
        const want = Math.max(1, Math.round(base * size)), j = C.JOB_BY_ID[jobId];
        const have = staffOf(w, jobId, b.id).length + w.vacancies.filter(v => v.biz === b.id && v.job.id === jobId).length;
        const prem = jobId === 'doctor' ? 1.25 : 1.1; // private pay premium
        for (let k = have; k < want; k++, posted++) post(w, j, Math.round(w.px(j.salary * prem) / 1000) * 1000, b.place, { biz: b.id });
      }
    }
    if (posted) w.vacancies.sort((a, b) => (b.salary - a.salary) || (a.id - b.id));
    const nurses = staffOf(w, 'nurse').length, doctors = staffOf(w, 'doctor').length, norm = Math.max(0.05, ts.pop / 1000);
    // Quality 0.4-1.3: public staffing against the Malaysian norm (diminishing returns).
    g.eduQ = U.clamp(Math.sqrt(staffOf(w, 'teacher').length / (12 * norm)), 0.4, 1.3);
    g.healthQ = U.clamp(Math.sqrt((nurses / 3.5 + doctors / 1.5) / 2 / norm), 0.4, 1.3);
    w.mortAdj = U.clamp(1.15 - 0.15 * g.healthQ, 0.95, 1.1);
  };

  // ---- Private businesses: placement, closure ----
  SV.canStart = function (w, t) {
    if (t.maxPer && w.biz.filter(b => b.open && b.type === t.id).length >= Math.floor(w.counts.living / t.maxPer)) return false;
    if (t.build) return w.town.lots.some(id => !w.town.buildings[id].built) || SV.vacantBuilding(w, t) !== undefined;
    return true;
  };
  SV.vacantBuilding = function (w, t) {
    const kind = t.build === 'e' ? 'privschool' : 'privhosp';
    return (w.town.kinds[kind] || []).find(id => !w.biz.some(b => b.open && b.place === id));
  };
  // A private school or hospital is built on an empty lot (or takes over an empty one).
  SV.buildFor = function (w, b) {
    const t = b.typeDef, kind = t.build === 'e' ? 'privschool' : 'privhosp';
    let id = SV.vacantBuilding(w, t);
    if (id === undefined) {
      const block = LES.growTown(w.town, t.build, b.name);
      if (!block) return w.town.byKind.office;
      id = w.town.kinds[kind][w.town.kinds[kind].length - 1];
      w.pushFeed({ day: w.day, pid: b.founderId, text: `${b.name} (${t.name.toLowerCase()}) is being built on empty land`, cat: 'biz', imp: 2 });
    }
    w.town.buildings[id].label = b.name; w.town.buildings[id].bizId = b.id;
    w.townVersion++;
    return id;
  };
  SV.onClose = function (w, b) {
    for (const p of w.living) if (p.alive && p.job && p.job.biz === b.id) LES.Labour.endJob(w, p, 'laid off');
    w.vacancies = w.vacancies.filter(v => v.biz !== b.id);
    for (const p of w.living) if (p.school === b.id) p.school = -1;
    if (b.typeDef.build) { const bd = w.town.buildings[b.place]; if (bd && bd.bizId === b.id) { bd.label = `${bd.kind === 'privschool' ? 'School' : 'Hospital'} (closed)`; w.townVersion++; } }
  };

  // ---- School choice (yearly, and when a child turns 7) and fees (monthly) ----
  SV.schoolMonth = function (w) {
    const schools = w.biz.filter(b => b.open && b.type === 'privschool');
    const seats = new Map(schools.map(b => [b.id, staffOf(w, 'teacher', b.id).length * SV.PRIVATE_SEATS]));
    for (const p of w.living) if (p.alive && p.school >= 0 && seats.has(p.school)) seats.set(p.school, seats.get(p.school) - 1);
    const R = w.rng.gov, jan = w.date.month === 0;
    for (const c of w.living) {
      if (!c.alive || c.adult || c.away) continue;
      const age = P.age(w, c);
      if (age < 7) continue;
      if (c.school === undefined) c.school = -1;
      const payers = c.caregivers.map(id => w.people[id]).filter(q => q && q.alive && !q.away);
      const inc = payers.reduce((s, q) => s + Math.max(0, q.incomeEMA), 0);
      if (c.school >= 0) { // pay this month's fees
        const b = w.biz[c.school], fee = b && b.open ? w.px(b.typeDef.fee) : 0;
        const payer = payers.find(q => q.cash >= fee + q.mcost);
        if (!fee || !payer || fee > inc * SV.PRIVATE_FEE_SHARE * 1.6) { c.school = -1; if (payers[0]) P.log(w, payers[0], `Moved ${c.first} back to the public school`, 'family', 0); }
        else { w.ledger.move(payer, 'cash', b, 'cash', fee); b.townRev = (b.townRev || 0) + fee; }
      } else if (schools.length && (jan || c._schoolAsk === undefined)) {
        c._schoolAsk = w.day;
        const b = schools.find(s => seats.get(s.id) > 0);
        if (!b) continue;
        const fee = w.px(b.typeDef.fee);
        const keen = 0.5 + 0.3 * (payers.length ? Math.max(...payers.map(q => q.pers.resp)) / 100 : 0) + (w.gov.eduQ < 0.9 ? 0.2 : 0);
        if (fee <= inc * SV.PRIVATE_FEE_SHARE && payers.some(q => q.cash > 3 * fee + q.mcost) && R.next() < keen) {
          c.school = b.id; seats.set(b.id, seats.get(b.id) - 1);
          P.log(w, payers[0], `Enrolled ${c.first} at ${b.name}`, 'family', 0);
        }
      }
      // Learning: quality of the school this child attends (yearly attributes use it).
      // Family background matters too: tuition, books and quiet study space (T20) or crowded homes (B40).
      const q = (c.school >= 0 ? 1.25 : w.gov.eduQ) + (c.cls === 'T20' ? 0.15 : c.cls === 'B40' ? -0.1 : 0);
      c.schoolQ = c.schoolQ === undefined ? q : c.schoolQ * 0.92 + q * 0.08;
    }
  };

  // Children who went to better-staffed schools learn more (applied after the yearly
  // attribute growth, so the effect carries into adulthood at 18).
  SV.childYear = function (w) {
    for (const c of w.living) {
      if (!c.alive || c.adult || c.schoolQ === undefined) continue;
      const f = 1 + 0.12 * (c.schoolQ - 1);
      c.att[C.INT] = U.clamp(c.att[C.INT] * f, 0, 10);
      c.att[C.PER] = U.clamp(c.att[C.PER] * (1 + 0.06 * (c.schoolQ - 1)), 0, 10);
    }
  };

  // ---- Medical bills: public care is subsidised by the treasury; richer patients may go
  // private (dearer, quicker). Classic engine: the patient pays the whole bill.
  SV.medicalBill = function (w, p, bill, minor) {
    const L = w.ledger;
    if (!w.gov) { L.spend(p, 'cash', 'HEALTH', bill); return bill; }
    const priv = w.biz.filter(b => b.open && b.typeDef.service === 'health' && (minor ? true : b.type === 'privhosp'));
    const rich = p.cls === 'T20' || p.cash > 12 * bill;
    if (priv.length && rich && bill > 0) {
      const b = priv[p.id % priv.length], amt = Math.min(p.cash, Math.round(bill * 1.4));
      if (amt > 0 && L.move(p, 'cash', b, 'cash', amt)) { b.townRev = (b.townRev || 0) + amt; p.health = Math.min(100, p.health + (minor ? 1 : 6)); return amt; }
    }
    // Public: RM1 at the klinik kesihatan; hospitals charge a small share of the cost.
    const own = minor ? Math.min(p.cash, w.px(1)) : Math.min(p.cash, Math.round(bill * 0.05));
    L.spend(p, 'cash', 'HEALTH', own);
    w.gov.month.healthSub = (w.gov.month.healthSub || 0) + Math.max(0, bill - own);
    return own;
  };
})(globalThis.LES = globalThis.LES || {});
