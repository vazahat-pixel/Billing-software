import React from 'react';
import { buildTotalsRows } from '../utils';
import { INK, PRINT_FONT } from '../constants';

/** Financial summary — layout variants for different templates */
export default function TotalsPanel({ data, variant = 'right', width = '48%' }) {
  const rows = buildTotalsRows(data);
  const { totals } = data;

  if (variant === 'inline') {
    return (
      <div className="ipe-avoid-break" style={{ marginTop: '4mm' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1mm 8mm', fontSize: PRINT_FONT.size.sm }}>
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <div style={{ color: INK.muted, textAlign: 'right' }}>{row.label}</div>
              <div
                className="ipe-tabular"
                style={{
                  textAlign: 'right',
                  fontWeight: row.bold ? 700 : 400,
                  color: row.accent ? INK.black : INK.body,
                  fontSize: row.accent ? PRINT_FONT.size.lg : undefined,
                }}
              >
                {row.value}
              </div>
            </React.Fragment>
          ))}
        </div>
        <AmountWords totals={totals} />
      </div>
    );
  }

  if (variant === 'ledger') {
    return (
      <div className="ipe-avoid-break" style={{ width, marginLeft: 'auto', marginTop: '3mm' }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: row.accent ? '2mm 0 1mm' : '1mm 0',
              borderTop: row.accent ? `2px solid ${INK.black}` : i > 0 ? `0.5px solid ${INK.rule}` : 'none',
              fontSize: row.accent ? PRINT_FONT.size.lg : PRINT_FONT.size.sm,
              fontWeight: row.bold || row.accent ? 700 : 400,
            }}
          >
            <span style={{ color: row.accent ? INK.black : INK.muted }}>{row.label}</span>
            <span className="ipe-tabular">{row.value}</span>
          </div>
        ))}
        <AmountWords totals={totals} align="right" />
      </div>
    );
  }

  // default: right column
  return (
    <div className="ipe-avoid-break" style={{ width, marginLeft: 'auto', marginTop: '4mm' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: PRINT_FONT.size.sm }}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td style={{ padding: '1mm 2mm 1mm 0', color: INK.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {row.label}
              </td>
              <td
                className="ipe-tabular"
                style={{
                  padding: '1mm 0',
                  textAlign: 'right',
                  fontWeight: row.bold || row.accent ? 700 : 400,
                  fontSize: row.accent ? PRINT_FONT.size.lg : PRINT_FONT.size.sm,
                  borderBottom: row.accent ? 'none' : `0.5px solid ${INK.rule}`,
                  width: '40%',
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AmountWords totals={totals} align="right" />
    </div>
  );
}

function AmountWords({ totals, align = 'left' }) {
  if (!totals?.amountWords) return null;
  return (
    <div
      style={{
        marginTop: '3mm',
        padding: '2mm 0',
        borderTop: `1px solid ${INK.rule}`,
        fontSize: PRINT_FONT.size.sm,
        fontStyle: 'italic',
        color: INK.muted,
        textAlign: align,
      }}
    >
      <span style={{ fontStyle: 'normal', fontWeight: 600, color: INK.dark }}>Amount in Words: </span>
      {totals.amountWords}
    </div>
  );
}

/** Tax breakdown table for GST audit */
export function TaxSummaryTable({ data, variant = 'compact' }) {
  const { taxRows, fmt, isIgst } = data;
  if (!taxRows?.length) return null;

  const money = (n) => fmt.money(n).replace(/^₹\s*/, '');

  if (variant === 'textile-audit') {
    return (
      <table className="ipe-table ipe-avoid-break" style={{ fontSize: '6.5pt' }}>
        <thead>
          <tr>
            <th>Tax (%)</th>
            <th style={{ textAlign: 'right' }}>Tax Value (Rs.)</th>
            <th style={{ textAlign: 'center' }}>CGST (%)</th>
            <th style={{ textAlign: 'right' }}>CGST Amount</th>
            <th style={{ textAlign: 'center' }}>UT/SGST (%)</th>
            <th style={{ textAlign: 'right' }}>UT/SGST Amount</th>
            <th style={{ textAlign: 'center' }}>IGST (%)</th>
            <th style={{ textAlign: 'right' }}>IGST Amount</th>
            <th style={{ textAlign: 'center' }}>CESS (%)</th>
            <th style={{ textAlign: 'right' }}>CESS Amount</th>
            <th style={{ textAlign: 'right' }}>TOTAL Amount</th>
          </tr>
        </thead>
        <tbody>
          {taxRows.map((row) => (
            <tr key={row.taxPct}>
              <td className="ipe-center">{row.taxPct}%</td>
              <td className="ipe-tabular ipe-right">{money(row.taxValue)}</td>
              <td className="ipe-center">{isIgst ? '—' : `${row.cgstPct}%`}</td>
              <td className="ipe-tabular ipe-right">{isIgst ? '—' : money(row.cgstAmt)}</td>
              <td className="ipe-center">{isIgst ? '—' : `${row.sgstPct}%`}</td>
              <td className="ipe-tabular ipe-right">{isIgst ? '—' : money(row.sgstAmt)}</td>
              <td className="ipe-center">{isIgst ? `${row.igstPct}%` : '—'}</td>
              <td className="ipe-tabular ipe-right">{isIgst ? money(row.igstAmt) : '—'}</td>
              <td className="ipe-center">{row.cessPct ? `${row.cessPct}%` : '—'}</td>
              <td className="ipe-tabular ipe-right">{row.cessAmt ? money(row.cessAmt) : '—'}</td>
              <td className="ipe-tabular ipe-right">{money(row.cgstAmt + row.sgstAmt + row.igstAmt + (row.cessAmt || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="ipe-table ipe-avoid-break" style={{ marginTop: '3mm', fontSize: '7pt' }}>
      <thead>
        <tr>
          <th style={{ width: '12%' }}>Tax %</th>
          <th style={{ width: '18%', textAlign: 'right' }}>Taxable</th>
          {isIgst ? (
            <th style={{ width: '18%', textAlign: 'right' }}>IGST</th>
          ) : (
            <>
              <th style={{ width: '14%', textAlign: 'right' }}>CGST</th>
              <th style={{ width: '14%', textAlign: 'right' }}>SGST</th>
            </>
          )}
          <th style={{ width: '18%', textAlign: 'right' }}>Total Tax</th>
        </tr>
      </thead>
      <tbody>
        {taxRows.map((row) => (
          <tr key={row.taxPct}>
            <td>{row.taxPct}%</td>
            <td className="ipe-tabular ipe-right">{fmt.money(row.taxValue).replace(/^₹\s*/, '')}</td>
            {isIgst ? (
              <td className="ipe-tabular ipe-right">{fmt.money(row.igstAmt).replace(/^₹\s*/, '')}</td>
            ) : (
              <>
                <td className="ipe-tabular ipe-right">{fmt.money(row.cgstAmt).replace(/^₹\s*/, '')}</td>
                <td className="ipe-tabular ipe-right">{fmt.money(row.sgstAmt).replace(/^₹\s*/, '')}</td>
              </>
            )}
            <td className="ipe-tabular ipe-right">
              {fmt.money(row.cgstAmt + row.sgstAmt + row.igstAmt).replace(/^₹\s*/, '')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
