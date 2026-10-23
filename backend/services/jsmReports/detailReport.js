'use strict';

/**
 * Builder for JSM "detail register" reports that hand AA_Rpt_GridReport_JC a view filtered by date and
 * ticked tab lists, ordered by X<GroupBy1>[, X<GroupBy2>] then the report's tie-break columns.
 */
const { orderRows, inList, inDateRange } = require('./jcEngine');

const DUPLICATE_ORDER = 'A column has been specified more than once in the order by list. Columns in the order by list must be unique.';

function detailReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const order1 = spec.groupBy1.includes(p.orderBy1) ? p.orderBy1 : spec.groupBy1[0];
    const order2 = spec.groupBy2.includes(p.orderBy2) ? p.orderBy2 : 'None';
    let rows = deps.rows || await spec.load(companyId);
    rows = inDateRange(rows, spec.dateField, p.from, p.to);
    for (const [param, field] of Object.entries(spec.filters)) rows = inList(rows, field, p[param]);
    if (spec.extraFilter) rows = spec.extraFilter(rows, p);

    const x1 = spec.xColumns[order1];
    const x2 = order2 === 'None' ? null : spec.xColumns[order2];
    const orderCols = [x1, x2, ...spec.tieBreak].filter(Boolean);
    const base = (c) => spec.xSource[c] || c;
    if (new Set(orderCols.map(base)).size !== orderCols.length) {
      const err = new Error(DUPLICATE_ORDER);
      err.status = 400;
      throw err;
    }
    const withFix = rows.map((r) => {
      const out = { ...r };
      for (const [x, src] of Object.entries(spec.xSource)) out[x] = r[src];
      return out;
    });
    return {
      rows: orderRows(withFix, orderCols),
      grid: {
        layout: spec.layout,
        variant: spec.variant[order1] || 1,
        groupColumns: [x1, x2].filter(Boolean),
        groupDisplays: [order1.toUpperCase(), order2 === 'None' ? '' : order2.toUpperCase()].filter(Boolean),
        primaryDetailColumn: spec.primary || 'XCO_ENT_NO',
        title: `${order1} ${spec.titleSuffix}`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }
  return { run, options: spec.options };
}

module.exports = { detailReport };
