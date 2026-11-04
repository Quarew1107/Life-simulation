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

  // ---- Week and festivals (shared by the simulation and the art) ----
  // 1 Jan Year 1 is a Monday: dow 0 = Monday ... 4 = Friday, 6 = Sunday.
  U.dow = day => ((day % 7) + 7) % 7;
  const lunar = (day, baseDoy) => { const y = Math.floor(day / 365); return ((baseDoy - 11 * y) % 365 + 365) % 365; };
  const near = (doy, d, span) => ((doy - d + 365) % 365) < span;
  // Festivals: lunar ones drift ~11 days earlier each year. The list comes from the country
  // pack's `calendar` (set up by js/data/countries/countries.js); first match wins.
  let FEST = [], FAST = null;
  LES.Calendar = {
    setup(cal) {
      FEST = (cal && cal.festivals) || [];
      const f = cal && cal.fast && FEST.find(x => x.id === cal.fast.before);
      FAST = f ? { doy: f.doy, lunar: !!f.lunar, days: cal.fast.days } : null;
    },
    // Returns the festival on this day ({ id, name }) or null.
    festival(day) {
      const doy = ((day % 365) + 365) % 365;
      for (const f of FEST) if (near(doy, f.lunar ? lunar(day, f.doy) : f.doy, f.span)) return { id: f.id, name: f.name };
      return null;
    },
    // First day of a festival (when people spend and celebrate).
    festivalStarts(day) { const f = LES.Calendar.festival(day), y = LES.Calendar.festival(day - 1); return f && (!y || y.id !== f.id) ? f : null; },
    // The fasting days before a festival (Ramadan before Hari Raya), if the country has one.
    ramadan(day) { if (!FAST) return false; const doy = ((day % 365) + 365) % 365, r = FAST.lunar ? lunar(day, FAST.doy) : FAST.doy; const d = (r - doy + 365) % 365; return d >= 1 && d <= FAST.days; },
  };

  // ---- Money ----
  // The currency sign comes from the country pack (U.setCurrency, called by js/data/countries/countries.js).
  let SYM = 'RM', MK = 1; // MK: the country's money scale (engine units -> real money for display)
  U.setCurrency = (sym, k) => { SYM = sym; MK = k || 1; };
  U.sym = () => SYM;
  U.fmtMoney = function (sen) {
    if (!Number.isFinite(sen)) return `${SYM}?`;
    const v = sen * MK / 100, a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e9) return `${s}${SYM}${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${s}${SYM}${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e4) return `${s}${SYM}${(a / 1e3).toFixed(1)}k`;
    // Under 10k: "RM9,999" (hand-rolled; toLocaleString is slow in hot paths).
    const r = Math.round(a);
    return r >= 1000 ? `${s}${SYM}${Math.floor(r / 1000)},${String(r % 1000).padStart(3, '0')}` : `${s}${SYM}${r}`;
  };
  // A whole amount in full, for fixed figures in texts: U.cur(11820) = "RM11,820".
  U.cur = amount => `${amount < 0 ? '-' : ''}${SYM}${Math.round(Math.abs(amount * MK)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  U.fmtPrice = sen => `${SYM}${(sen * MK / 100).toFixed(sen * MK < 1000 ? 3 : 2)}`; // share prices
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
