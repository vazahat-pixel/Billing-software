'use strict';

/**
 * JSM: Reports › Sales › Sales Bill › Haste/Transport (Rpt_Sales_Haste).
 *
 * The screen's A/B/C/D radio (Haste / Packers / Transport / Lr Dispatch) picks what the bills are
 * grouped under, with a sub-heading per group and a Grand Total — confirmed from the owner's own
 * printed output (Sales_Report.pdf, 03/11/2026): "PACKERS:" header, then rows of
 * Bill_No / Bill Date / Party / Haste / Item / Pcs / Rate / Amount, Grand Total at the foot.
 *
 * A: Haste and C: Transport group on the bill's own fields (Sales.haste / Sales.transport).
 * B: Packers groups on each item LINE's own free-text field — confirmed by reading
 * TMP_VW_PACKERS, the transient view JSM itself had built for this exact report while the owner's
 * recording was made: `C.IT_DISC1` from T_SL_ITEM, which is this software's `items[].desc`.
 * D: Lr Dispatch has no field distinct from the LR number anywhere in this software, so it is
 * refused with a message rather than grouping under the wrong thing.
 */
const { loadSalesRegisterRows } = require('../sources/billRegister');
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

const MODES = {
  A: { label: 'Haste', perLine: false, field: 'HASTE' },
  B: { label: 'Packers', perLine: true, field: 'IT_DISC1' },
  C: { label: 'Transport', perLine: false, field: 'TRANSPORT' },
};

function modeOf(raw) {
  const m = String(raw ?? 'A').trim().toUpperCase();
  if (MODES[m]) return m;
  if (m === 'D') {
    const err = new Error('Lr Dispatch grouping has no field in this software yet — use Haste, Packers or Transport.');
    err.status = 400;
    throw err;
  }
  return 'A';
}

async function run(companyId, p = {}, deps = {}) {
  const mode = modeOf(p.mode);
  const spec = MODES[mode];

  let bills = deps.rows || await loadSalesRegisterRows(companyId);
  bills = inDateRange(bills, 'BILL_DATE', p.from, p.to);
  if (Array.isArray(p.parties) && p.parties.length) bills = inList(bills, 'PARTY', p.parties);
  if (Array.isArray(p.accounts) && p.accounts.length) {
    bills = spec.perLine
      ? bills.map((b) => ({ ...b, _lines: b._lines.filter((l) => p.accounts.includes(l[spec.field])) })).filter((b) => b._lines.length)
      : inList(bills, spec.field, p.accounts);
  }

  const lines = [];
  for (const bill of bills) {
    for (const l of bill._lines) {
      lines.push({
        GROUP2: (spec.perLine ? l[spec.field] : bill[spec.field]) || '',
        NCBILL_NO: bill.NCBILL_NO,
        BILL_DATE: bill.BILL_DATE,
        PARTY: bill.PARTY,
        HASTE: bill.HASTE,
        ITEM_NAME: l.ITEM_NAME,
        IT_PCS: l.IT_PCS,
        IT_QTY: l.IT_QTY,
        IT_RATE: l.IT_RATE,
        IT_AMOUNT: round(l.IT_AMOUNT),
      });
    }
  }

  const ordered = orderRows(lines, ['GROUP2', 'BILL_DATE', 'NCBILL_NO']);

  return {
    rows: ordered,
    grid: {
      layout: 'JSM_VW_SALES_HASTE_REPORT',
      variant: 1,
      groupColumns: ['GROUP2'],
      groupDisplays: [spec.label.toUpperCase()],
      primaryDetailColumn: 'NCBILL_NO',
      captions: { GROUP2: spec.label.toUpperCase() },
      // JSM's own printed heading for each mode ("Report : Haste Wise Sales Report", …).
      title: `${spec.label} Wise Sales Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId, p = {}, deps = {}) {
  const bills = deps.rows || await loadSalesRegisterRows(companyId);
  const u = (vals) => [...new Set(vals.filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
  return {
    hastes: u(bills.map((r) => r.HASTE)),
    transports: u(bills.map((r) => r.TRANSPORT)),
    packers: u(bills.flatMap((r) => r._lines.map((l) => l.IT_DISC1))),
    parties: u(bills.map((r) => r.PARTY)),
  };
}

module.exports = { run, options, modeOf };
