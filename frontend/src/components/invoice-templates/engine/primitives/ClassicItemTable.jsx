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
                    <div style={{ fontSize: '7.5pt', color: '#1e293b', marginTop: '0.8mm', fontStyle: 'normal', fontWeight: 400 }}>
                      {line.pcsDetails.map((pd) => {
                        const pcs = Number(pd.pcs ?? pd.qty ?? 1);
                        let qtyBndl = Number(pd.qtyBndl ?? pd.qtyPerBndl ?? 0);
                        if (!qtyBndl && pcs > 0 && Number(pd.netQty ?? pd.kgs)) {
                          qtyBndl = Number(((Number(pd.netQty ?? pd.kgs) || 0) / pcs).toFixed(2));
                        }
                        return `${qtyBndl > 0 ? qtyBndl.toFixed(2) : '0.00'}x${pcs}`;
                      }).join(' , ')}
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
              const isMeterUnit = (u) => ['MTRS', 'MTS', 'QTY', 'NETQTY'].includes(String(u || 'MTRS').toUpperCase());
              const totalMts = (lines || []).reduce((s, l) => s + (isMeterUnit(l.unit) ? (Number(l.mts) || 0) : 0), 0);
              return (
                <td key={col.id} className="ipe-num" style={{ textAlign: 'right' }}>
                  {totalMts > 0 ? totalMts.toFixed(2) : '0.00'}
                </td>
              );
            }
            if (col.id === 'netMts') {
              const isMeterUnit = (u) => ['MTRS', 'MTS', 'QTY', 'NETQTY'].includes(String(u || 'MTRS').toUpperCase());
              const totalNetMts = (lines || []).reduce((s, l) => {
                if (!isMeterUnit(l.unit)) return s;
                if (Array.isArray(l.pcsDetails) && l.pcsDetails.length > 0) {
                  const sum = l.pcsDetails.reduce((ss, r) => {
                    const rowPcs = Number(r.pcs ?? r.qty) || 0;
                    const qtyBndl = Number(r.qtyBndl ?? r.qtyPerBndl) || 0;
                    if (rowPcs > 0 && qtyBndl > 0) return ss + rowPcs * qtyBndl;
                    return ss + (Number(r.netQty ?? r.kgs) || 0);
                  }, 0);
                  if (sum > 0) return s + sum;
                }
                const rawMts = Number(l.mts) || 0;
                const fold = Number(l.fold || 0);
                if (rawMts > 0 && fold > 0 && fold < 100) {
                  return s + Number(((rawMts * fold) / 100).toFixed(2));
                }
                return s + rawMts;
              }, 0);
              return (
                <td key={col.id} className="ipe-num" style={{ textAlign: 'right', fontWeight: 700 }}>
                  {totalNetMts > 0 ? totalNetMts.toFixed(2) : '0.00'}
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
