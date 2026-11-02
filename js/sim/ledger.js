// Single gateway for every money movement. Balances live on people/businesses
// (cash, trust, epf) and on named external sectors (employers, merchants, bank...).
// Money is never created or destroyed: sum(all balances incl. sectors) is always 0.
(function (LES) {
  'use strict';

  LES.SECTORS = ['GENESIS', 'EMPLOYER', 'GIGS', 'MERCHANT', 'EDUCATION', 'TRAINING', 'HEALTH', 'BANK',
    'MARKET', 'CUSTOMER', 'SUPPLIER', 'WELFARE', 'ESTATE', 'LUCK', 'TAX'];

  class Ledger {
    constructor() {
      this.sec = {};
      for (const s of LES.SECTORS) this.sec[s] = { bal: 0, isSector: true, name: s };
      this.txns = 0;
      this.writeOffs = 0; // debts the bank had to forgive (sen)
    }

    // Move amt sen from from[fk] to to[tk]. Non-sector accounts can never go negative:
    // returns false (and changes nothing) if funds are insufficient.
    move(from, fk, to, tk, amt) {
      if (!Number.isFinite(amt)) throw new Error('Ledger: non-finite amount');
      amt = Math.round(amt);
      if (amt < 0) throw new Error('Ledger: negative amount');
      if (amt === 0) return true;
      if (!from.isSector && !(from[fk] >= amt)) return false;
      from[fk] -= amt;
      to[tk] += amt;
      this.txns++;
      return true;
    }
    pay(sector, to, tk, amt) { return this.move(this.sec[sector], 'bal', to, tk, amt); }
    spend(from, fk, sector, amt) { return this.move(from, fk, this.sec[sector], 'bal', amt); }
    sectorTotal() { let t = 0; for (const s in this.sec) t += this.sec[s].bal; return t; }
  }

  LES.Ledger = Ledger;
})(globalThis.LES = globalThis.LES || {});
