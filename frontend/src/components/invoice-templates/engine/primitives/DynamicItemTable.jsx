import React, { useMemo } from 'react';
import { resolvePrintColumns, formatCellValue } from '../columnRegistry';
import { INK } from '../constants';

/**
 * Premium dynamic item table — repeating header, page-break safe rows.
 */
export default function DynamicItemTable({
  data,
  templateId,
  columnIds,
  variant = 'standard',
  dense = false,
  showFooter = true,
  headerStyle = {},
  cellStyle = {},
}) {
  const { lines, fmt, lineTotals, company } = data;
  const businessType = company?.tagline || '';

  const columns = useMemo(
    () => resolvePrintColumns({ templateId, lines, businessType, columnIds }),
    [templateId, lines, businessType, columnIds]
  );

  if (!lines?.length) {
    return (
      <div style={{ padding: '4mm 0', color: INK.muted, fontSize: '8pt', textAlign: 'center' }}>
        No line items
      </div>
    );
  }

  const isMinimal = variant === 'minimal';
  const isLuxury = variant === 'luxury';

  return (
    <table className="ipe-table" style={{ marginTop: dense ? '2mm' : '3mm' }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.id}
              style={{
                width: col.width,
                textAlign: col.align,
                ...(isLuxury ? { borderBottom: '2px solid #111', paddingBottom: '3mm' } : {}),
                ...headerStyle,
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.sno}>
            {columns.map((col) => {
              const sub = col.renderSub?.(line);
              const val = formatCellValue(col, line, fmt);
              return (
                <td
                  key={col.id}
                  style={{
                    textAlign: col.align,
                    ...(isMinimal ? { borderBottom: 'none', borderTop: `0.5px solid ${INK.rule}` } : {}),
                    ...cellStyle,
                  }}
                  className={col.format === 'money' || col.align === 'right' ? 'ipe-tabular' : ''}
                >
                  <div>{val}</div>
                  {sub && col.id === 'item' ? (
                    <div className="ipe-item-sub">{sub}</div>
                  ) : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {showFooter && (lineTotals?.pcs || lineTotals?.mts) ? (
        <tfoot>
          <tr>
            {columns.map((col, i) => {
              if (i === 0) return <td key={col.id}>Total</td>;
              if (col.id === 'pcs') return <td key={col.id} className="ipe-tabular ipe-right">{lineTotals.pcs || '—'}</td>;
              if (col.id === 'mts') return <td key={col.id} className="ipe-tabular ipe-right">{fmt.num(lineTotals.mts) || '—'}</td>;
              if (col.id === 'amount' || col.id === 'taxable')
                return <td key={col.id} className="ipe-tabular ipe-right">{fmt.money(lineTotals.amount).replace(/^₹\s*/, '')}</td>;
              return <td key={col.id} />;
            })}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
