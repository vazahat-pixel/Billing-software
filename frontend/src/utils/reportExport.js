import * as XLSX from 'xlsx';

/** CSV & Excel export helpers for reports */

export const downloadCsv = (filename, headers, rows) => {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const cleanFilename = String(filename || 'Report').replace(/[/\\?%*:|"<>]/g, '_');
  const finalFilename = cleanFilename.toLowerCase().endsWith('.csv')
    ? cleanFilename
    : cleanFilename.toLowerCase().endsWith('.xlsx')
      ? `${cleanFilename.slice(0, -5)}.csv`
      : `${cleanFilename}.csv`;

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => (Array.isArray(row) ? row.map(escape).join(',') : ''))
  ];

  // Add \uFEFF UTF-8 BOM so Microsoft Excel opens it directly with correct UTF-8 encoding
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Universal table-to-Excel exporter using SheetJS (XLSX).
 * Generates true, non-blank .xlsx binary workbooks with proper column widths
 * and clean numeric formatting.
 *
 * Supports both signatures:
 *   exportTableToExcel(filename, columns, rows)
 *   exportTableToExcel(columns, rows, filename)
 */
export const exportTableToExcel = (arg1, arg2, arg3) => {
  let filename = 'Report';
  let columns = [];
  let rows = [];

  if (typeof arg1 === 'string') {
    filename = arg1;
    columns = Array.isArray(arg2) ? arg2 : [];
    rows = Array.isArray(arg3) ? arg3 : [];
  } else if (Array.isArray(arg1) && Array.isArray(arg2)) {
    columns = arg1;
    rows = arg2;
    filename = typeof arg3 === 'string' ? arg3 : 'Report';
  } else if (Array.isArray(arg1)) {
    rows = arg1;
    filename = typeof arg2 === 'string' ? arg2 : 'Report';
  }

  if (!rows || rows.length === 0) return;

  const cleanFilename = String(filename || 'Report').replace(/[/\\?%*:|"<>]/g, '_');
  const finalFilename = cleanFilename.toLowerCase().endsWith('.xlsx')
    ? cleanFilename
    : `${cleanFilename}.xlsx`;

  // Determine effective column descriptors
  let effectiveCols = [];
  if (columns && columns.length > 0) {
    effectiveCols = columns.map((c) => {
      if (typeof c === 'string') return { key: c, label: c };
      return { key: c.key || c.dataIndex, label: c.label || c.title || c.key, render: c.render };
    });
  } else if (rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    effectiveCols = Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  }

  // Build sheet rows
  const sheetData = rows.map((r) => {
    // If r is already an array of values
    if (Array.isArray(r)) {
      const rowObj = {};
      r.forEach((val, idx) => {
        const header = effectiveCols[idx]?.label || `Col ${idx + 1}`;
        rowObj[header] = val ?? '';
      });
      return rowObj;
    }

    // If r is an object, map via effectiveCols
    const rowObj = {};
    effectiveCols.forEach((c) => {
      let val = r[c.key];

      // If render function exists and raw value is nullish or formatted
      if (c.render && typeof c.render === 'function') {
        try {
          const rendered = c.render(r);
          if (typeof rendered === 'string' || typeof rendered === 'number') {
            val = rendered;
          }
        } catch (_) {}
      }

      // Convert currency formatted strings like "₹50,000.00" to clean numeric values
      if (typeof val === 'string' && /^[₹\s]*-?[\d,]+(\.\d+)?$/.test(val.trim())) {
        const num = Number(val.replace(/[₹,\s]/g, ''));
        if (!isNaN(num)) val = num;
      } else if (val === null || val === undefined) {
        val = '';
      }

      rowObj[c.label] = val;
    });
    return rowObj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);

  // Auto-fit column widths
  const colWidths = effectiveCols.map((c) => {
    const labelLen = String(c.label || '').length;
    return { wch: Math.max(labelLen + 4, 14) };
  });
  ws['!cols'] = colWidths;

  const sheetName = cleanFilename.slice(0, 31).replace(/[\\/?*[\]]/g, '');
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');

  // Trigger browser file download
  XLSX.writeFile(wb, finalFilename);
};

export const getMonthRange = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

export const fmtAmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
