import React, { useMemo } from 'react';
import { resolvePrintColumns, formatCellValue } from '../columnRegistry';

const MIN_ROWS = 8;

/**
 * Classic bordered item grid — matches Surat textile ERP print (full vertical lines).
 */
export default function ClassicItemTable({ data, templateId = 'textile-pro', paymentTerms = '' }) {
  const { lines, fmt, lineTotals } = data;

  const columns = useMemo(
    () => resolvePrintColumns({ templateId, lines, businessType: 'Textile' }),
    [templateId, lines]
  );

  const emptyCount = Math.max(0, MIN_ROWS - (lines?.length || 0));

  return (
    <table className="ipe-classic-grid" style={{ margin: 0 }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.id} style={{ width: col.width, textAlign: col.align === 'right' ? 'right' : col.align }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(lines || []).map((line) => (
          <tr key={line.sno}>
            {columns.map((col) => {
              const val = formatCellValue(col, line, fmt);
              return (
                <td
                  key={col.id}
                  style={{
                    textAlign: col.align,
                    height: '7mm',
                    fontSize: col.id === 'item' ? '9pt' : '8.5pt',
                  }}
                  className={col.format === 'money' || col.align === 'right' ? 'ipe-num' : ''}
                >
                  {val}
                  {col.id === 'item' && Array.isArray(line.pcsDetails) && line.pcsDetails.length > 0 && (
                    <div style={{ fontSize: '7pt', color: '#334155', marginTop: '1mm', fontStyle: 'italic', fontWeight: 500 }}>
                      {line.pcsDetails.map((pd, pidx) => (
                        <span key={pidx} style={{ marginRight: '2.5mm', display: 'inline-block' }}>
                          {pd.pcs || 1} Pcs × {(pd.netQty || pd.kgs || pd.qty || 0).toFixed(2)} = {((pd.pcs || 1) * (pd.netQty || pd.kgs || pd.qty || 0)).toFixed(2)} {pd.remark ? `(${pd.remark})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`empty-${i}`}>
            {columns.map((col) => (
              <td key={col.id} style={{ height: '7mm' }}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          {columns.map((col, i) => {
            if (i === 0) {
              return (
                <td key={col.id} colSpan={1} style={{ fontWeight: 700 }}>
                  Total
                </td>
              );
            }
            if (col.id === 'item') {
              return (
                <td key={col.id} style={{ fontSize: '8pt', fontWeight: 400 }}>
                  {paymentTerms || ''}
                </td>
              );
            }
            if (col.id === 'pcs') {
              return (
                <td key={col.id} className="ipe-num" style={{ textAlign: 'right' }}>
                  {lineTotals?.pcs || ''}
                </td>
              );
            }
            if (col.id === 'mts') {
              return (
                <td key={col.id} className="ipe-num" style={{ textAlign: 'right' }}>
                  {lineTotals?.mts ? fmt.num(lineTotals.mts) : ''}
                </td>
              );
            }
            if (col.id === 'amount') {
              return (
                <td key={col.id} className="ipe-num" style={{ textAlign: 'right' }}>
                  {lineTotals?.amount ? fmt.money(lineTotals.amount).replace(/^₹\s*/, '') : ''}
                </td>
              );
            }
            return <td key={col.id}>&nbsp;</td>;
          })}
        </tr>
      </tfoot>
    </table>
  );
}
