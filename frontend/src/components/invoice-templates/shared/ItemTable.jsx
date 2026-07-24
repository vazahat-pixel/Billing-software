import React from 'react';

const thBase = (extra = {}) => ({
  padding: '6px 4px',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  ...extra,
});

const tdBase = (extra = {}) => ({
  padding: '5px 4px',
  borderBottom: '1px solid #e2e8f0',
  verticalAlign: 'top',
  fontSize: 9,
  ...extra,
});

/**
 * Full GST item table — textile-aware (pcs/mts/fold/cut) when present.
 */
export function ItemTable({
  data,
  headerBg = '#0f172a',
  headerColor = '#fff',
  zebra = '#f8fafc',
  dense = false,
  showTaxCols = true,
}) {
  const { lines, isSale, isIgst, fmt } = data;
  const pad = dense || lines.length > 20 ? '3px 3px' : '5px 4px';
  const fs = dense || lines.length > 20 ? 8 : 9;

  return (
    <table
      className="invoice-item-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: fs,
        marginBottom: 12,
      }}
    >
      <thead>
        <tr style={{ background: headerBg, color: headerColor }}>
          <th style={thBase({ width: 22, textAlign: 'center' })}>#</th>
          <th style={thBase({ textAlign: 'left' })}>Item / Description</th>
          <th style={thBase({ width: 40, textAlign: 'center' })}>HSN</th>
          {isSale && <th style={thBase({ width: 32, textAlign: 'center' })}>Fold</th>}
          {isSale && <th style={thBase({ width: 32, textAlign: 'center' })}>Cut</th>}
          <th style={thBase({ width: 36, textAlign: 'right' })}>Qty</th>
          <th style={thBase({ width: 32, textAlign: 'center' })}>Unit</th>
          <th style={thBase({ width: 48, textAlign: 'right' })}>Rate</th>
          <th style={thBase({ width: 40, textAlign: 'right' })}>Disc</th>
          <th style={thBase({ width: 54, textAlign: 'right' })}>Taxable</th>
          {showTaxCols && !isIgst && (
            <>
              <th style={thBase({ width: 44, textAlign: 'right' })}>CGST</th>
              <th style={thBase({ width: 44, textAlign: 'right' })}>SGST</th>
            </>
          )}
          {showTaxCols && isIgst && (
            <th style={thBase({ width: 48, textAlign: 'right' })}>IGST</th>
          )}
          <th style={thBase({ width: 56, textAlign: 'right' })}>Total</th>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 && (
          <tr>
            <td colSpan={14} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
              No line items
            </td>
          </tr>
        )}
        {lines.map((line, idx) => (
          <tr
            key={idx}
            className="invoice-item-row"
            style={{
              background: idx % 2 === 1 ? zebra : '#fff',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <td style={tdBase({ textAlign: 'center', color: '#64748b', padding: pad })}>{line.sno}</td>
            <td style={tdBase({ textAlign: 'left', fontWeight: 600, padding: pad })}>
              {line.name}
              {line.desc ? (
                <div style={{ fontWeight: 400, color: '#64748b', fontSize: fs - 1 }}>{line.desc}</div>
              ) : null}
              {isSale && (line.pcs || line.mts) ? (
                <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: fs - 1 }}>
                  {line.pcs ? `${line.pcs} pcs` : ''}
                  {line.pcs && line.mts ? ' · ' : ''}
                  {line.mts ? `${fmt.num(line.mts)} mtr` : ''}
                </div>
              ) : null}
            </td>
            <td style={tdBase({ textAlign: 'center', color: '#64748b', padding: pad })}>{line.hsn}</td>
            {isSale && <td style={tdBase({ textAlign: 'center', padding: pad })}>{line.fold || '—'}</td>}
            {isSale && <td style={tdBase({ textAlign: 'center', padding: pad })}>{line.cut || '—'}</td>}
            <td style={tdBase({ textAlign: 'right', fontFamily: 'ui-monospace, monospace', padding: pad })}>
              {fmt.num(line.qty || line.mts || line.pcs)}
            </td>
            <td style={tdBase({ textAlign: 'center', padding: pad })}>{line.unit}</td>
            <td style={tdBase({ textAlign: 'right', fontFamily: 'ui-monospace, monospace', padding: pad })}>
              {fmt.num(line.rate)}
            </td>
            <td style={tdBase({ textAlign: 'right', fontFamily: 'ui-monospace, monospace', padding: pad })}>
              {line.discount ? fmt.num(line.discount) : '—'}
            </td>
            <td style={tdBase({ textAlign: 'right', fontFamily: 'ui-monospace, monospace', padding: pad })}>
              {fmt.num(line.taxable)}
            </td>
            {showTaxCols && !isIgst && (
              <>
                <td style={tdBase({ textAlign: 'right', fontSize: fs - 1, padding: pad })}>
                  {line.cgstPct ? `${line.cgstPct}%` : ''}
                  <br />
                  {fmt.num(line.cgstAmt)}
                </td>
                <td style={tdBase({ textAlign: 'right', fontSize: fs - 1, padding: pad })}>
                  {line.sgstPct ? `${line.sgstPct}%` : ''}
                  <br />
                  {fmt.num(line.sgstAmt)}
                </td>
              </>
            )}
            {showTaxCols && isIgst && (
              <td style={tdBase({ textAlign: 'right', fontSize: fs - 1, padding: pad })}>
                {line.igstPct ? `${line.igstPct}%` : ''}
                <br />
                {fmt.num(line.igstAmt)}
              </td>
            )}
            <td
              style={tdBase({
                textAlign: 'right',
                fontWeight: 700,
                fontFamily: 'ui-monospace, monospace',
                padding: pad,
              })}
            >
              {fmt.num(line.total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TotalsBlock({ data, accent = '#0f172a', boxed = true }) {
  const { totals, isIgst, fmt } = data;
  const row = (label, value, bold) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '5px 10px',
        borderBottom: '1px solid #f1f5f9',
        fontSize: 10,
        fontWeight: bold ? 700 : 500,
        color: bold ? '#0f172a' : '#475569',
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{value}</span>
    </div>
  );

  return (
    <div
      className="invoice-avoid-break"
      style={{
        border: boxed ? '1px solid #e2e8f0' : 'none',
        borderRadius: boxed ? 6 : 0,
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {row('Subtotal', fmt.money(totals.subtotal))}
      {totals.discount > 0 && row('Discount', fmt.money(totals.discount))}
      {row('Taxable Value', fmt.money(totals.taxable), true)}
      {!isIgst ? (
        <>
          {row('CGST', fmt.money(totals.cgst))}
          {row('SGST', fmt.money(totals.sgst))}
        </>
      ) : (
        row('IGST', fmt.money(totals.igst))
      )}
      {totals.tcs > 0 && row(`TCS${totals.tcsPer ? ` (${totals.tcsPer}%)` : ''}`, fmt.money(totals.tcs))}
      {totals.roundOff !== 0 && row('Round Off', fmt.money(totals.roundOff))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: accent,
          color: '#fff',
          fontWeight: 800,
          fontSize: 13,
          border: boxed ? `2px solid ${accent}` : 'none',
        }}
      >
        <span>Grand Total</span>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{fmt.money(totals.grandTotal)}</span>
      </div>
    </div>
  );
}

export function AmountInWords({ words, accent = '#92400e', bg = '#fffbeb' }) {
  return (
    <div
      style={{
        border: '1px solid #fcd34d',
        borderRadius: 6,
        padding: '8px 12px',
        background: bg,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 800,
          color: accent,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        Amount in Words
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, fontStyle: 'italic' }}>{words}</div>
    </div>
  );
}
