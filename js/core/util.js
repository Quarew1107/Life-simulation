// Small shared helpers: maths, calendar, money formatting.
// Money is always stored as integer sen (1 gold = RM1 = 100 sen).
(function (LES) {
  'use strict';
  const U = LES.U = {};

  U.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  U.sigmoid = x => 1 / (1 + Math.exp(-x));
  U.RM = rm => Math.round(rm * 100); // RM -> sen

  // ---- Calendar: 365-day years, real month lengths, day 0 = 1 Jan Year 1 ----
  U.MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  U.MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_START = [];
  { let s = 0; for (const d of U.MONTH_DAYS) { MONTH_START.push(s); s += d; } }

  U.dayToDate = function (day) {
    const y = Math.floor(day / 365);
    const doy = day - y * 365;
    let m = 11;
    while (m > 0 && MONTH_START[m] > doy) m--;
    const dom = doy - MONTH_START[m] + 1;
    const dim = U.MONTH_DAYS[m];
    return { year: y + 1, month: m, dom, doy, dim, lastOfMonth: dom === dim, lastOfYear: doy === 364 };
  };
  U.fmtDate = day => { const d = U.dayToDate(day); return `${d.dom} ${U.MONTH_NAMES[d.month]} Y${d.year}`; };
  U.fmtMonthYear = day => { const d = U.dayToDate(day); return `${U.MONTH_NAMES[d.month]} Y${d.year}`; };

  // ---- Money ----
  U.fmtMoney = function (sen) {
    if (!Number.isFinite(sen)) return 'RM?';
    const v = sen / 100, a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e9) return `${s}RM${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${s}RM${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e4) return `${s}RM${(a / 1e3).toFixed(1)}k`;
    return `${s}RM${Math.round(a).toLocaleString('en-US')}`;
  };
  U.fmtPct = x => `${Math.round(x * 100)}%`;

  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- Statistics ----
  U.sum = arr => { let s = 0; for (const x of arr) s += x; return s; };
  U.quantile = function (sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  U.median = arr => U.quantile([...arr].sort((a, b) => a - b), 0.5);
  U.gini = function (values) {
    const v = values.map(x => Math.max(0, x)).sort((a, b) => a - b);
    const n = v.length, total = U.sum(v);
    if (n < 2 || total <= 0) return 0;
    let acc = 0;
    for (let i = 0; i < n; i++) acc += (i + 1) * v[i];
    return (2 * acc) / (n * total) - (n + 1) / n;
  };
})(globalThis.LES = globalThis.LES || {});
