// Headless engine runner for Node (no browser needed). Developer tool.
//   node tools/headless.js hash  [seeds=a,b] [days=1500] [cfg='{"founders":100}']
//   node tools/headless.js soak  [seeds=a,b] [years=120] [cfg=...]   invariants every quarter
//   node tools/headless.js calib [seeds=a,b] [years=100] [cfg=...]   sim vs Malaysia targets
//   node tools/headless.js tests [only=unitTests,foundationTests]   the browser test suite in Node
//   node tools/headless.js bench [founders=100] [years=30] [cfg=...]
// The engine files are loaded in the same order as index.html.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..', 'js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Load every script listed in index.html that lives in core/, data/ or sim/ (the engine).
const files = [...html.matchAll(/<script src="js\/((?:core|data|sim)\/[^"]+)"/g)].map(m => m[1]);
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const LES = globalThis.LES;

const args = {};
for (const a of process.argv.slice(3)) { const i = a.indexOf('='); if (i > 0) args[a.slice(0, i)] = a.slice(i + 1); }
const cfgExtra = args.cfg ? JSON.parse(args.cfg) : {};
const seeds = (args.seeds || 'h-1,h-2').split(',');
const mode = process.argv[2] || 'hash';

function fingerprint(w) {
  const logN = w.people.reduce((s, p) => s + p.log.length, 0);
  const lastLog = w.feed.length ? w.feed[w.feed.length - 1].text : '';
  const soft = w.living.reduce((s, p) => s + p.happy + p.stress + p.energy + p.health, 0);
  return `${w.hash().slice(0, 16)}:${w.people.length}:${logN}:${LES.hashString(lastLog)[0].toString(16)}:${soft.toFixed(3)}`;
}

if (mode === 'hash') {
  const days = Number(args.days || 1500);
  for (const seed of seeds) {
    const t0 = Date.now(), w = new LES.World(Object.assign({ seed }, cfgExtra)), marks = [];
    while (!w.ended && w.day < days) { w.step(); if (w.day % 500 === 0 || w.day === days) marks.push(`d${w.day}:${fingerprint(w)}`); }
    console.log(`${seed} ${marks.join(' ')} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
} else if (mode === 'soak') {
  const years = Number(args.years || 120);
  let bad = 0;
  for (const seed of seeds) {
    const t0 = Date.now();
    let w;
    try {
      w = new LES.World(Object.assign({ seed }, cfgExtra));
      while (!w.ended && w.day < years * 365) {
        w.step();
        if (w.date.lastOfMonth && w.date.month % 3 === 2) {
          const errs = w.checkInvariants();
          if (errs.length) { bad++; console.log(`${seed} INVARIANT day ${w.day}: ${errs.slice(0, 5).join(' | ')}`); break; }
        }
      }
      const h = w.history[w.history.length - 1];
      console.log(`${seed} ok y${Math.floor(w.day / 365)} pop=${h.pop} biz=${h.businesses} gini=${h.gini.toFixed(2)} ${w.endReason || ''} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (e) { bad++; console.log(`${seed} CRASH day ${w ? w.day : '?'}: ${e.stack}`); }
  }
  process.exitCode = bad ? 1 : 0;
} else if (mode === 'calib') {
  const years = Number(args.years || 100);
  const rows = [];
  for (const seed of seeds) {
    const w = new LES.World(Object.assign({ seed }, cfgExtra));
    while (!w.ended && w.day < years * 365) w.step();
    rows.push(LES.Calibration.measure(w));
  }
  console.log(LES.Calibration.table(rows));
} else if (mode === 'tests') {
  // The browser test suite (js/tests/tests.js) with a minimal stand-in for the page.
  const out = { textContent: '', appendChild(el) { this.textContent += el.textContent; process.stdout.write(el.textContent); } };
  globalThis.document = { getElementById: () => out, createElement: () => ({ className: '', textContent: '' }), title: '' };
  globalThis.window = globalThis; globalThis.location = { search: '' };
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tests', 'tests.js'), 'utf8'), { filename: 'tests.js' });
  const which = args.only ? args.only.split(',') : null;
  (async () => {
    // only=invariantSweep:3:60 passes arguments
    if (which) { for (const k of which) { const [name, ...a] = k.split(":"); await globalThis.LES_TESTS[name](...a.map(Number)); } } else await globalThis.LES_TESTS.runAll();
    process.exitCode = /FAIL/.test(out.textContent) ? 1 : 0;
  })();
} else if (mode === 'bench') {
  const founders = Number(args.founders || 100), years = Number(args.years || 30);
  const t0 = Date.now(), w = new LES.World(Object.assign({ seed: seeds[0], founders }, cfgExtra));
  while (!w.ended && w.day < years * 365) w.step();
  const s = (Date.now() - t0) / 1000;
  console.log(`${founders} founders, ${years}y: ${s.toFixed(1)}s = ${(w.day / s).toFixed(0)} days/s, pop ${w.counts.living}`);
}
