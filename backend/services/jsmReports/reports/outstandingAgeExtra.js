'use strict';

/**
 * JSM: Others Reports › Outstanding Zoom › Age Analysis & Os New Format Testing:
 *   - Rpt_Outstating_Age_Report (Debitors Age)
 *   - A_Jsm_Os_Sales_Age_Analysys_Updated (Debitors Excel Age Analysis)
 *   - Rpt_Outstating_ReportSales (Os New Format Testing)
 *
 * All figures come straight from sources/outstanding.js (reportService.getOutstanding),
 * never recomputed or guessed.
 */
const { loadOutstandingRows, loadOutstandingAgeRows } = require('../sources/outstanding');
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');

function parseBoundaries(p, count, defaults) {
  const vals = [];
  for (let i = 1; i <= count; i++) {
    const n = Number(p[`day${i}`] ?? p[`ageDay${i}`] ?? defaults[i - 1]);
    vals.push(Number.isFinite(n) && n > 0 ? n : defaults[i - 1]);
  }
  return vals;
}

const debitorsAge = {
  async run(companyId, p = {}, deps = {}) {
    const cutoff = Number(p.cutoffDays ?? p.day ?? 90) || 90;
    const status = p.status === '2-Clear' || p.status === 'Clear' ? 'Paid' : (p.status === '3-All' || p.status === 'All' ? 'All' : 'Pending');
    const orderBy = p.orderBy1 === 'Broker' ? 'BROKER' : 'PARTY';

    let rows = deps.rows || await loadOutstandingAgeRows(companyId, 'sales', {
      asOn: p.asOn || p.to,
      billDateFrom: p.from,
      billDateTo: p.to,
      paidDateFrom: p.recFrom,
      paidDateTo: p.recTo,
      status,
      includeLastYear: p.includeLastYear !== false,
      ageDay1: 30,
      ageDay2: 60,
      ageDay3: cutoff,
    });
    rows = inList(rows, 'PARTY', p.parties);
    rows = inList(rows, 'BROKER', p.brokers);

    // Build JSM Rpt_Outstating_Age_Report format: Before Cutoff / After Cutoff + 4-bucket breakdown
    const enriched = rows.map((r) => {
      const b1 = Number(r.BAL_AMT1 || 0);
      const b2 = Number(r.BAL_AMT2 || 0);
      const b3 = Number(r.BAL_AMT3 || 0);
      const b4 = Number(r.BAL_AMT4 || 0);
      const unadj = p.withUnadjust === false ? 0 : Number(r.BAL_UNADJ || 0);
      const beforeCut = round(b1 + b2 + b3);
      return {
        PARTY: r.PARTY || '',
        BROKER: r.BROKER || '',
        BEFORE_DAYS: beforeCut,
        AFTER_DAYS: round(b4),
        BAL_AMT1: round(b1),
        BAL_AMT2: round(b2),
        BAL_AMT3: round(b3),
        BAL_AMT4: round(b4),
        BAL_UNADJ: round(unadj),
        TOT_BALANCE: round(beforeCut + b4 + unadj),
      };
    });

    const grouped = orderBy === 'BROKER'
      ? groupBy(enriched, ['BROKER', 'PARTY'], {
          sum: ['BEFORE_DAYS', 'AFTER_DAYS', 'BAL_AMT1', 'BAL_AMT2', 'BAL_AMT3', 'BAL_AMT4', 'BAL_UNADJ', 'TOT_BALANCE'],
        })
      : enriched;

    return {
      rows: orderRows(grouped, orderBy === 'BROKER' ? ['BROKER', 'PARTY'] : ['PARTY']),
      grid: {
        layout: 'RUNTIME_AGE_DEBITORS',
        variant: 1,
        groupColumns: orderBy === 'BROKER' ? ['BROKER'] : [],
        groupDisplays: orderBy === 'BROKER' ? ['BROKER'] : [],
        captions: {
          BEFORE_DAYS: `${cutoff} Days Before`,
          AFTER_DAYS: `${cutoff} Days After`,
          BAL_AMT3: `61-${cutoff} Days`,
          BAL_AMT4: `${cutoff + 1} Above Days`,
        },
        title: `Debitors Age Analysis (${orderBy === 'BROKER' ? 'Broker' : 'Party'} Wise)`,
        period: `BILL DATE : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  },

  async options(companyId) {
    const rows = await loadOutstandingRows(companyId, 'sales', {});
    const uniq = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v || '').trim()))].sort();
    return { parties: uniq('PARTY'), brokers: uniq('BROKER') };
  },
};

const SIDE_MAP = {
  Sales: 'sales',
  Purchase: 'purchase',
  Process: 'process',
  Jobwork: 'jobwork',
};

const debitorsExcelAge = {
  async run(companyId, p = {}, deps = {}) {
    const sideKey = SIDE_MAP[p.side] || 'sales';
    const [d1, d2, d3, d4] = parseBoundaries(p, 4, [30, 60, 90, 120]);
    const status = p.status === 'Clear' || p.status === '2-Clear' ? 'Paid' : (p.status === 'All' || p.status === '3-All' ? 'All' : 'Pending');

    let bills = deps.rows || await loadOutstandingRows(companyId, sideKey, {
      asOn: p.asOn || p.to,
      billDateFrom: p.from,
      billDateTo: p.to,
      paidDateFrom: p.recFrom,
      paidDateTo: p.recTo,
      status,
      includeLastYear: p.includeLastYear !== false,
    });
    bills = inList(bills, 'PARTY', p.parties);
    bills = inList(bills, 'BROKER', p.brokers);

    const bucketMap = new Map();
    for (const r of bills) {
      const party = String(r.PARTY || '').trim();
      if (!bucketMap.has(party)) {
        bucketMap.set(party, {
          PARTY: party,
          BROKER: r.BROKER || '',
          GST_NO: r.GSTIN_NO || r.GST_NO || '',
          BAL_AMT1: 0,
          BAL_AMT2: 0,
          BAL_AMT3: 0,
          BAL_AMT4: 0,
          BAL_AMT5: 0,
          BAL_UNADJ: 0,
          TOT_BALANCE: 0,
        });
      }
      const entry = bucketMap.get(party);
      const bal = Number(r.TOT_BALANCE ?? r.BAL_AMT ?? 0);
      const days = Number(r.OS_DAYS ?? 0);
      if (days < 0) {
        if (p.withUnadjust !== false) entry.BAL_UNADJ = round(entry.BAL_UNADJ + bal);
      } else if (days <= d1) {
        entry.BAL_AMT1 = round(entry.BAL_AMT1 + bal);
      } else if (days <= d2) {
        entry.BAL_AMT2 = round(entry.BAL_AMT2 + bal);
      } else if (days <= d3) {
        entry.BAL_AMT3 = round(entry.BAL_AMT3 + bal);
      } else if (days <= d4) {
        entry.BAL_AMT4 = round(entry.BAL_AMT4 + bal);
      } else {
        entry.BAL_AMT5 = round(entry.BAL_AMT5 + bal);
      }
      entry.TOT_BALANCE = round(
        entry.BAL_AMT1 + entry.BAL_AMT2 + entry.BAL_AMT3 + entry.BAL_AMT4 + entry.BAL_AMT5 + entry.BAL_UNADJ
      );
    }

    const orderField = p.orderBy1 === 'Broker' ? ['BROKER', 'PARTY'] : ['PARTY'];
    return {
      rows: orderRows([...bucketMap.values()], orderField),
      grid: {
        layout: 'RUNTIME_OS_AGE_EXCEL',
        variant: 1,
        groupColumns: p.orderBy1 === 'Broker' ? ['BROKER'] : [],
        groupDisplays: p.orderBy1 === 'Broker' ? ['BROKER'] : [],
        captions: {
          BAL_AMT1: `0-${d1}`,
          BAL_AMT2: `${d1 + 1}-${d2}`,
          BAL_AMT3: `${d2 + 1}-${d3}`,
          BAL_AMT4: `${d3 + 1}-${d4}`,
          BAL_AMT5: `>${d4}`,
          BAL_UNADJ: 'UNADJUST',
        },
        title: `${p.side || 'Sales'} Outstanding [Age Analysis] Report`,
        period: `AS ON DATE : ${p.asOnText || p.asOn || p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },

  async options(companyId) {
    const rows = await loadOutstandingRows(companyId, 'sales', {});
    const uniq = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v || '').trim()))].sort();
    return { parties: uniq('PARTY'), brokers: uniq('BROKER') };
  },
};

const GROUP_FIELD = {
  None: null,
  Register: 'BOOK',
  Book: 'BOOK',
  Party: 'PARTY',
  Broker: 'BROKER',
  Station: 'STATION',
  MainGroup: 'MAINGROUP',
  MonthWise: 'MONTHWISE',
};

const osNewFormatTesting = {
  async run(companyId, p = {}, deps = {}) {
    const status = p.status === 'Clear' || p.status === '2-Clear' ? 'Paid' : (p.status === 'All' || p.status === '3-All' ? 'All' : 'Pending');
    let rows = deps.rows || await loadOutstandingRows(companyId, 'sales', {
      asOn: p.asOn || p.to,
      billDateFrom: p.from,
      billDateTo: p.to,
      paidDateFrom: p.recFrom,
      paidDateTo: p.recTo,
      status,
      dueDaysMin: p.dueDays ? Number(p.dueDays) : undefined,
      onlyDirectBillClose: Boolean(p.onlyDirectBillClose),
      onlyPartReceived: Boolean(p.onlyPartReceived),
      onlyRgPending: Boolean(p.onlyRgPending),
      includeLastYear: p.includeLastYear !== false,
    });

    for (const [k, f] of [['parties', 'PARTY'], ['brokers', 'BROKER'], ['stations', 'STATION'], ['books', 'BOOK'], ['mainGroups', 'MAINGROUP']]) {
      rows = inList(rows, f, p[k]);
    }
    if (p.from || p.to) rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);

    const g1 = GROUP_FIELD[p.orderBy1] ?? 'PARTY';
    const g2 = GROUP_FIELD[p.orderBy2] ?? null;
    const summary = Boolean(p.summary);

    const normalized = rows.map((r) => ({
      ...r,
      BILL_NO: r.NCBILL_NO || '',
      BILL_AMT: round(r.NET_TOT ?? r.BILL_AMT ?? 0),
      PAID_AMT: round(r.ADJUST ?? r.PAID_AMT ?? 0),
      PAID_DIS: round(r.TOT_DISC ?? r.PAID_DIS ?? 0),
      SALERTN_AMT: round(r.GOODS_RTN ?? r.SALERTN_AMT ?? 0),
      JV_ADLS: round(r.JV_ADLS ?? 0),
      BAL_AMT: round(r.TOT_BALANCE ?? r.BAL_AMT ?? 0),
      GROUP1: g1 ? (r[g1] || '') : '',
      GROUP2: g2 ? (r[g2] || '') : '',
    }));

    if (summary) {
      const keys = [g1 || 'PARTY', g2].filter(Boolean);
      const grouped = groupBy(normalized, keys, {
        sum: ['BILL_AMT', 'PAID_AMT', 'PAID_DIS', 'SALERTN_AMT', 'JV_ADLS', 'BAL_AMT'],
      }, (first) => ({
        GROUP1: first[keys[0]] || '',
        GROUP2: keys[1] ? (first[keys[1]] || '') : '',
        NET_TOT: 0,
      }));
      for (const g of grouped) g.NET_TOT = round(g.BILL_AMT);
      return {
        rows: orderRows(grouped, ['GROUP1', 'GROUP2']),
        grid: {
          layout: 'RPT_OSSALES_SUMMARY',
          variant: 'S',
          groupColumns: [],
          groupDisplays: [],
          captions: {},
          title: `${p.orderBy1 || 'Party'} Wise Sales OutStanding Summary Report`,
          period: `BILL DATE : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
          pageWise: p.printout === '2-PageWise',
        },
      };
    }

    const groupColumns = [g1, g2].filter(Boolean);
    return {
      rows: orderRows(normalized, [...groupColumns, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
      grid: {
        layout: 'RPT_OSSALES_DETAIL',
        variant: 'S',
        groupColumns,
        groupDisplays: groupColumns,
        primaryDetailColumn: '_billId',
        captions: {},
        title: `${p.orderBy1 || 'Party'} Wise Sales OutStanding Report (New Format)`,
        period: `BILL DATE : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  },

  async options(companyId) {
    const rows = await loadOutstandingRows(companyId, 'sales', {});
    const uniq = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v || '').trim()))].sort();
    return {
      parties: uniq('PARTY'),
      brokers: uniq('BROKER'),
      stations: uniq('STATION'),
      books: uniq('BOOK'),
      mainGroups: uniq('MAINGROUP'),
    };
  },
};

module.exports = { debitorsAge, debitorsExcelAge, osNewFormatTesting };
