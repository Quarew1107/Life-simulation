// Deterministic seeded random numbers. sfc32 generator + cyrb128 string hash
// (both public domain, see github.com/bryc/code/blob/master/jshash/PRNGs.md).
// The simulation never uses Math.random(): same seed + same settings = same world.
(function (LES) {
  'use strict';

  function hashString(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  class RNG {
    constructor(seed) {
      const s = hashString(String(seed));
      this.a = s[0]; this.b = s[1]; this.c = s[2]; this.d = s[3];
      for (let i = 0; i < 15; i++) this.next();
    }
    // Uniform float in [0, 1)
    next() {
      let a = this.a | 0, b = this.b | 0, c = this.c | 0, d = this.d | 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      this.a = a; this.b = b; this.c = c; this.d = d;
      return (t >>> 0) / 4294967296;
    }
    range(min, max) { return min + (max - min) * this.next(); }
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); } // inclusive
    chance(p) { return this.next() < p; }
    normal(mean = 0, sd = 1) {
      let u = 0;
      while (u === 0) u = this.next();
      const v = this.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    poisson(lambda) {
      if (!(lambda > 0)) return 0;
      if (lambda > 30) return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
      const L = Math.exp(-lambda);
      let k = 0, p = 1;
      do { k++; p *= this.next(); } while (p > L);
      return k - 1;
    }
    // Index chosen with probability proportional to weights; -1 if all weights are zero.
    weighted(weights) {
      let total = 0;
      for (const w of weights) total += w > 0 ? w : 0;
      if (!(total > 0)) return -1;
      let r = this.next() * total;
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] > 0) { r -= weights[i]; if (r < 0) return i; }
      }
      for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
      return -1;
    }
    state() { return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0]; }
  }

  LES.RNG = RNG;
  LES.hashString = hashString;
})(globalThis.LES = globalThis.LES || {});
