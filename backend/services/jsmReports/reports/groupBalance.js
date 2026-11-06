'use strict';

/**
 * JSM: Reports › Final Reports › Group List (Rpt_Group_Balance).
 *
 * One line per account, under its own head, showing the single signed balance as on a date —
 * JSM's own SQL (Genrate_Reports) is
 *
 *   SELECT SUM(A.DR_AMOUNT - A.CR_AMOUNT) AS DRCR_BAL1, A.AC_NAME, MAX(A.GRAC_HEAD) ...
 *   FROM JSM_VW_LEDGER_ACCOUNT A WHERE ... AND A.ENT_DATE <= '<as on>' GROUP BY A.AC_NAME
 *
 * so it is the closing balance per account, carrying its head — which is what
 * financialReportsService.groupedTrialBalance() already works out, head grouping and all. The
 * screen reuses JSM's Trail Balance window (same captured form), which is why it looks like it.
 *
 * JSM also offers With Address / With PanNo / With Broker. This software records the account's
 * city but no PAN or broker against a ledger, so With Address adds the city column and the other
 * two are left alone rather than printing an empty column.
 */
const financialReportsService = require('../../financialReportsService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

async function run(companyId, p = {}) {
  const asOn = p.to || p.from;
  const tb = await financialReportsService.groupedTrialBalance(companyId, {
    asOn,
    withZeroBalance: Boolean(p.withZero),
  });

  const heads = Array.isArray(p.heads) && p.heads.length
    ? new Set(p.heads.map((h) => String(h).trim().toUpperCase()))
    : null;
  const skip = Array.isArray(p.excludeAccounts) && p.excludeAccounts.length
    ? new Set(p.excludeAccounts.map((a) => String(a).trim().toUpperCase()))
    : null;

  const rows = [];
  for (const g of tb.groups) {
    if (heads && !heads.has(g.name.toUpperCase())) continue;
    for (const l of g.lines) {
      if (skip && skip.has(String(l.name).trim().toUpperCase())) continue;
      rows.push({
        GRAC_HEAD: g.name,
        AC_NAME: l.name,
        // JSM's DRCR_BAL1: one signed figure, debit positive.
        DRCR_BAL1: round2(l.debit - l.credit),
        PARTY_CITY: l.station || '',
      });
    }
  }

  return {
    rows,
    grid: {
      layout: 'JSM_VW_GROUP_BALANCE',
      variant: 1,
      groupColumns: ['GRAC_HEAD'],
      groupDisplays: ['GROUP'],
      captions: {},
      title: `Group List Balance  As On Date ${p.toText || p.fromText || asOn || ''}`,
      period: '',
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const tb = await financialReportsService.groupedTrialBalance(companyId, { withZeroBalance: true });
  return {
    heads: tb.groups.map((g) => g.name).sort((a, b) => a.localeCompare(b)),
    accounts: tb.groups.flatMap((g) => g.lines.map((l) => l.name)).sort((a, b) => a.localeCompare(b)),
  };
}

module.exports = { run, options };
