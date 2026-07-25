import { describe, it, expect } from 'vitest';
import { money, taxOn, lineTaxable, calcSalesBillTotals } from './salesBillCalc';

describe('salesBillCalc', () => {
  it('money rounds to 2 decimals', () => {
    expect(money(87.09275)).toBe(87.09);
    expect(money(NaN)).toBe(0);
    expect(money(undefined)).toBe(0);
  });

  it('0% tax is exactly 0', () => {
    expect(taxOn(3483.71, 0)).toBe(0);
    expect(taxOn(0, 5)).toBe(0);
    expect(taxOn(100, 0)).toBe(0);
  });

  it('taxOn matches 2.5% of taxable', () => {
    expect(taxOn(3483.71, 2.5)).toBe(87.09);
    expect(taxOn(3483.71, 5)).toBe(174.19);
  });

  it('lineTaxable uses user amounts only (not %)', () => {
    expect(
      lineTaxable({ amount: 44, dis1Amt: 2.2, dis2Amt: 2.09, addAmt: 3444, dis1Per: 99 })
    ).toBe(3483.71);
  });

  it('bill totals: multi-line + 0% TCS', () => {
    const items = [
      { amount: 44, dis1Amt: 2.2, dis2Amt: 2.09, addAmt: 3444, gstAmt: 174.19 },
      { amount: 5, dis1Amt: 66, dis2Amt: 6, addAmt: 6, gstAmt: 6 },
    ];
    const r = calcSalesBillTotals(
      items,
      { tcsRate: 0, roundOff: 0, foldLess: 0, rdAmt: 0, discountAmt: 0, lessAmt: 0, addAmt: 0 },
      { type: 'INVOICE IN STATE' },
      { cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 }
    );
    // 3483.71 + (5-66-6+6) = 3422.71
    expect(r.gross).toBe(49);
    expect(r.taxable).toBe(3422.71);
    expect(r.cgst).toBe(85.57);
    expect(r.sgst).toBe(85.57);
    expect(r.tcsAmt).toBe(0);
    expect(r.net).toBe(3593.85);
  });

  it('all zero rates → gst and tcs zero, net = taxable', () => {
    const r = calcSalesBillTotals(
      [{ amount: 100, dis1Amt: 0, dis2Amt: 0, addAmt: 0 }],
      { tcsRate: 0, roundOff: 0 },
      { type: 'INVOICE IN STATE' },
      { cgstRate: 0, sgstRate: 0, igstRate: 0 }
    );
    expect(r.taxable).toBe(100);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
    expect(r.gstAmt).toBe(0);
    expect(r.tcsAmt).toBe(0);
    expect(r.net).toBe(100);
  });
});
