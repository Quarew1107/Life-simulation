// Save / load a whole world as JSON. The world is an object graph (people, businesses,
// the town, caches) with shared references, Maps, Sets, typed arrays, a few class
// instances and references into the read-only content tables (jobs, businesses...).
// It is written as a flat table of objects so every shared reference, and every
// cache that affects results, comes back exactly: a loaded world continues with the
// same history as the original (checked by the tests).
(function (LES) {
  'use strict';
  const S = LES.Save = {};
  S.VERSION = 1;

  // Classes that can appear inside a world, restored with their prototype.
  const classes = () => ({ World: LES.World, RNG: LES.RNG, Ledger: LES.Ledger, WhySlot: LES.Actions.WhySlot, Region: LES.Region });

  // Content-table objects are saved as a path ("JOBS.3") rather than copied.
  let contentIdx = null;
  function contentIndex() {
    if (contentIdx) return contentIdx;
    const byObj = new Map(), byPath = new Map();
    const walk = (o, path, depth) => {
      if (!o || typeof o !== 'object' || byObj.has(o) || depth > 6) return;
      byObj.set(o, path); byPath.set(path, o);
      for (const k of Object.keys(o)) walk(o[k], `${path}.${k}`, depth + 1);
    };
    walk(LES.C, 'C', 0);
    contentIdx = { byObj, byPath };
    return contentIdx;
  }

  // Values that JSON cannot hold.
  function prim(v) {
    if (v === undefined) return { $u: 1 };
    if (typeof v === 'number' && !Number.isFinite(v)) return { $n: String(v) };
    return v;
  }

  S.encode = function (world) {
    const ci = contentIndex(), ids = new Map(), table = [];
    const ref = v => {
      if (v === null || typeof v !== 'object') {
        if (typeof v === 'function') {
          if (v.$restore) return { $fn: v.$restore };
          throw new Error('Save: cannot store a function');
        }
        return prim(v);
      }
      const cp = ci.byObj.get(v);
      if (cp) return { $c: cp };
      let id = ids.get(v);
      if (id === undefined) { id = table.length; ids.set(v, id); table.push(null); table[id] = pack(v); }
      return { $r: id };
    };
    function pack(o) {
      if (Array.isArray(o)) return { t: 'a', v: o.map(ref) };
      if (o instanceof Map) return { t: 'm', v: [...o].map(([k, x]) => [ref(k), ref(x)]) };
      if (o instanceof Set) return { t: 's', v: [...o].map(ref) };
      if (o instanceof Float64Array) return { t: 'f64', v: Array.from(o, prim) };
      const name = o.constructor && o.constructor !== Object ? o.constructor.name : '';
      if (name && !classes()[name]) throw new Error(`Save: unknown class ${name}`);
      const v = {};
      for (const k of Object.keys(o)) v[k] = ref(o[k]);
      return name ? { t: 'c', c: name, v } : { t: 'o', v };
    }
    const root = ref(world);
    return { app: 'LES', version: S.VERSION, saved: new Date().toISOString(), day: world.day, seed: (world.cfg || world.base).seed, country: LES.Countries.of(world.cfg || world.base), root, table };
  };

  S.decode = function (data) {
    if (!data || data.app !== 'LES' || !Array.isArray(data.table)) throw new Error('Not a Life Evolution Simulator save file.');
    if (data.version !== S.VERSION) throw new Error(`Save file version ${data.version} is not supported (expected ${S.VERSION}).`);
    if (!LES.Countries.get(data.country || LES.Countries.DEFAULT)) throw new Error(`This save is from a country this version does not have (${data.country}).`);
    LES.Countries.use(data.country || LES.Countries.DEFAULT); // content tables of the save's country
    const ci = contentIndex(), K = classes(), T = data.table, out = new Array(T.length);
    const fns = [];
    // Pass 1: create empty shells, so references can point at them in any order.
    T.forEach((e, i) => {
      if (e.t === 'a') out[i] = new Array(e.v.length);
      else if (e.t === 'm') out[i] = new Map();
      else if (e.t === 's') out[i] = new Set();
      else if (e.t === 'f64') out[i] = new Float64Array(e.v.length);
      else if (e.t === 'c') { if (!K[e.c]) throw new Error(`Save: unknown class ${e.c}`); out[i] = Object.create(K[e.c].prototype); }
      else out[i] = {};
    });
    const val = (x, owner, key) => {
      if (x === null || typeof x !== 'object') return x;
      if ('$r' in x) return out[x.$r];
      if ('$c' in x) { const o = ci.byPath.get(x.$c) || ci.byPath.get(x.$c.replace(/\.malaysia/g, '.national')); if (!o) throw new Error(`Save: missing content ${x.$c}`); return o; }
      if ('$u' in x) return undefined;
      if ('$n' in x) return Number(x.$n);
      if ('$fn' in x) { fns.push({ owner, key, name: x.$fn }); return null; }
      throw new Error('Save: bad value');
    };
    // Pass 2: fill them in.
    T.forEach((e, i) => {
      const o = out[i];
      if (e.t === 'a') e.v.forEach((x, j) => { o[j] = val(x, o, j); });
      else if (e.t === 'm') for (const [k, x] of e.v) o.set(val(k), val(x));
      else if (e.t === 's') for (const x of e.v) o.add(val(x));
      else if (e.t === 'f64') e.v.forEach((x, j) => { o[j] = val(x); });
      else for (const k of Object.keys(e.v)) o[k] = val(e.v[k], o, k);
    });
    for (const f of fns) {
      if (f.name === 'townAdd') f.owner[f.key] = LES.townAdder(f.owner);
      else throw new Error(`Save: unknown function ${f.name}`);
    }
    const w = val(data.root);
    if (LES.Region && w instanceof LES.Region) { // a region of towns: reconnect each town to it
      LES.upgradeConfig(w.base);
      w.towns.forEach((t, i) => { t.afterLoad(); LES.Region.attach(t, w, i, t.townName); });
      return w;
    }
    if (!(w instanceof LES.World)) throw new Error('Save: file does not contain a world.');
    w.afterLoad();
    return w;
  };

  S.toJSON = world => JSON.stringify(S.encode(world));
  S.fromJSON = text => S.decode(JSON.parse(text));
})(globalThis.LES = globalThis.LES || {});
