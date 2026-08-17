/** CSV export helpers for reports */

export const downloadCsv = (filename, headers, rows) => {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(','))
  ];
  // Add \uFEFF UTF-8 BOM so Microsoft Excel opens it directly with correct encoding
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportTableToExcel = (filename, columns, rows) => {
  const headers = columns.map((c) => (typeof c === 'string' ? c : c.label || c.key || ''));
  const body = rows.map((r) =>
    columns.map((c) => {
      const key = typeof c === 'string' ? c : c.key;
      const val = r[key];
      if (c.render && typeof c.render === 'function') {
        const res = c.render(r);
        if (typeof res === 'string' || typeof res === 'number') return res;
      }
      return val ?? '';
    })
  );
  downloadCsv(filename.endsWith('.csv') ? filename : `${filename}.csv`, headers, body);
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

