import { useMemo } from 'react';

/**
 * useReportGrouping Hook
 * Provides 2-level hierarchical grouping, subtotals, and sorting for report tables.
 *
 * @param {Array} rows - Array of transaction objects
 * @param {string} groupBy1 - Primary group key (e.g. 'partyName', 'gstin', 'book', 'gstRate', 'state')
 * @param {string} groupBy2 - Secondary group key (optional)
 * @param {Array} sumFields - Fields to aggregate (e.g. ['taxableAmount', 'cgst', 'sgst', 'igst', 'netAmount'])
 * @returns {Array|null} Grouped tree with totals, or null if no grouping selected
 */
export function useReportGrouping(rows = [], groupBy1 = '', groupBy2 = '', sumFields = ['taxableAmount', 'cgst', 'sgst', 'igst', 'cess', 'netAmount']) {
  return useMemo(() => {
    if (!groupBy1 || !rows?.length) return null;

    const round2 = (v) => Number(Number(v || 0).toFixed(2));
    const extractKey = (row, key) => {
      if (!row || !key) return 'Unknown';
      if (key === 'party') return row.partyName || row.party || 'No Party';
      if (key === 'gstin') return (row.gstin || 'UNREGISTERED').toUpperCase();
      if (key === 'book') return row.bookName || row.book || 'Default';
      if (key === 'gstRate') return `${row.gstRate || 0}%`;
      if (key === 'state') return row.stateName || row.state || 'Other';
      if (key === 'date') return row.date ? new Date(row.date).toISOString().slice(0, 10) : 'No Date';
      if (key === 'month') return row.date ? new Date(row.date).toISOString().slice(0, 7) : 'No Month';
      return String(row[key] || 'Other');
    };

    const groupMap = new Map();

    for (const r of rows) {
      const g1Key = extractKey(r, groupBy1);
      if (!groupMap.has(g1Key)) {
        const initialTotals = {};
        sumFields.forEach((f) => { initialTotals[f] = 0; });
        groupMap.set(g1Key, {
          key: g1Key,
          groupBy: groupBy1,
          count: 0,
          ...initialTotals,
          rows: [],
          subGroupMap: groupBy2 ? new Map() : null,
        });
      }

      const g1 = groupMap.get(g1Key);
      g1.count += 1;
      sumFields.forEach((f) => {
        g1[f] = round2(g1[f] + Number(r[f] || 0));
      });

      if (groupBy2) {
        const g2Key = extractKey(r, groupBy2);
        if (!g1.subGroupMap.has(g2Key)) {
          const initialSubTotals = {};
          sumFields.forEach((f) => { initialSubTotals[f] = 0; });
          g1.subGroupMap.set(g2Key, {
            key: g2Key,
            groupBy: groupBy2,
            count: 0,
            ...initialSubTotals,
            rows: [],
          });
        }
        const g2 = g1.subGroupMap.get(g2Key);
        g2.count += 1;
        sumFields.forEach((f) => {
          g2[f] = round2(g2[f] + Number(r[f] || 0));
        });
        g2.rows.push(r);
      } else {
        g1.rows.push(r);
      }
    }

    // Convert map to structured array
    return Array.from(groupMap.values()).map((g1) => {
      const res = {
        key: g1.key,
        groupBy: g1.groupBy,
        count: g1.count,
      };
      sumFields.forEach((f) => { res[f] = g1[f]; });

      if (g1.subGroupMap) {
        res.subGroups = Array.from(g1.subGroupMap.values()).map((g2) => {
          const subRes = {
            key: g2.key,
            groupBy: g2.groupBy,
            count: g2.count,
            rows: g2.rows,
          };
          sumFields.forEach((f) => { subRes[f] = g2[f]; });
          return subRes;
        });
      } else {
        res.rows = g1.rows;
      }
      return res;
    });
  }, [rows, groupBy1, groupBy2, sumFields]);
}

export default useReportGrouping;
