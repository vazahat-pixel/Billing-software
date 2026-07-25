import React from 'react';

const PLACEHOLDER_NAME = /^(company|my company|your company name)$/i;

export function displayFirmName(name) {
  const n = String(name || '').trim();
  if (!n || PLACEHOLDER_NAME.test(n)) return '';
  return n;
}

export const THEMES = {
  'gst-formal': {
    className: 'gst-formal',
    ink: '#111',
    border: '1px solid #111',
    font: 'Arial, Helvetica, sans-serif',
    letterheadBg: '#fff',
    thBg: '#f3f4f6',
    accent: '#111',
    titleBar: false,
    headerBand: false,
  },
  'erp-classic': {
    className: 'erp-classic',
    ink: '#0f172a',
    border: '1px solid #334155',
    font: "'Segoe UI', Tahoma, Geneva, sans-serif",
    letterheadBg: '#f8fafc',
    thBg: '#e2e8f0',
    accent: '#0f172a',
    titleBar: true,
    headerBand: false,
    outerBorder: '2px solid #0f172a',
  },
  'commerce-pro': {
    className: 'commerce-pro',
    ink: '#0f172a',
    border: '1px solid #cbd5e1',
    font: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    letterheadBg: '#fff',
    thBg: '#ecfdf5',
    accent: '#0f766e',
    titleBar: false,
    headerBand: true,
    bandColor: '#0f766e',
  },
  executive: {
    className: 'executive',
    ink: '#0c1222',
    border: '1px solid #1e293b',
    font: "Georgia, 'Times New Roman', serif",
    letterheadBg: '#0b1f3a',
    letterheadInk: '#f8fafc',
    thBg: '#e8eef5',
    accent: '#1e3a5f',
    titleBar: false,
    headerBand: false,
    darkLetterhead: true,
  },
};

/**
 * Production tax-invoice grid used by all professional print themes.
 * Same data density as textile CRM bills — only chrome/colors differ.
 */
export default function TaxInvoiceLayout({ data, themeId = 'gst-formal' }) {
  const theme = THEMES[themeId] || THEMES['gst-formal'];
  const {
    company,
    meta,
    billTo,
    shipTo,
    isIgst,
    lines,
    lineTotals,
    taxRows,
    totals,
    bank,
    termsList,
    gstRate,
  } = data;

  const ink = theme.ink;
  const border = theme.border;
  const ship = shipTo || billTo;
  const firmName = displayFirmName(company?.name);
  const firmDisplay = firmName ? firmName.toUpperCase() : '';
  const hasBank = !!(bank?.bankName || bank?.accountNo || bank?.ifsc);
  const qtyLabel = (lines || []).some((l) => /KG/i.test(String(l.unit || ''))) ? 'Kgs' : 'Mts';
  const emptyPad = Math.max(0, 2 - (lines?.length || 0));
  const headInk = theme.darkLetterhead ? theme.letterheadInk || '#fff' : ink;

  const cell = (extra = {}) => ({
    border,
    padding: '3px 4px',
    fontSize: 9,
    verticalAlign: 'top',
    color: ink,
    lineHeight: 1.3,
    overflow: 'hidden',
    wordBreak: 'break-word',
    ...extra,
  });

  const th = (extra = {}) =>
    cell({
      fontWeight: 700,
      fontSize: 8,
      textAlign: 'center',
      verticalAlign: 'middle',
      background: theme.thBg,
      color: ink,
      whiteSpace: 'nowrap',
      ...extra,
    });

  const num = (n, digits = 2) =>
    (Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  const partyCell = (title, p) => (
    <td style={cell({ width: '34%' })}>
      <div style={{ fontSize: 8, fontWeight: 700, marginBottom: 2, color: theme.accent }}>{title}</div>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>
        {p?.name || ''}
      </div>
      {(p?.addressLines || []).map((line, i) => (
        <div key={i} style={{ fontSize: 8 }}>
          {line}
        </div>
      ))}
      {!p?.addressLines?.length && p?.address ? <div style={{ fontSize: 8 }}>{p.address}</div> : null}
      <div style={{ fontSize: 8, marginTop: 2 }}>GSTIN : {p?.gstin || ''}</div>
      <div style={{ fontSize: 8 }}>State : {p?.stateLabel || p?.state || ''}</div>
    </td>
  );

  const invLine = (label, value) => (
    <tr>
      <td style={{ fontSize: 9, padding: '1px 0', width: 88, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ fontSize: 9, padding: '1px 0', fontWeight: 700 }}>: {value || ''}</td>
    </tr>
  );

  /** Compact meta cell — label above value, never nowrap-overflow */
  const tf = (label, value, w) => (
    <td style={cell({ width: w, fontSize: 8 })}>
      <div style={{ fontSize: 7, color: '#444', marginBottom: 1 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value === 0 || value ? String(value) : ''}
      </div>
    </td>
  );

  const taxCell = (extra = {}) =>
    cell({
      textAlign: 'right',
      fontSize: 8,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      ...extra,
    });

  const row =
    (taxRows && taxRows[0]) ||
    {
      taxPct: gstRate || 0,
      taxValue: totals.taxable,
      cgstPct: isIgst ? 0 : (gstRate || 0) / 2,
      cgstAmt: totals.cgst,
      sgstPct: isIgst ? 0 : (gstRate || 0) / 2,
      sgstAmt: totals.sgst,
      igstPct: isIgst ? gstRate || 0 : 0,
      igstAmt: totals.igst,
      total: Number(totals.taxable || 0) + Number(totals.gst || 0),
    };

  return (
    <div
      className={`invoice-template ${theme.className}`}
      style={{
        fontFamily: theme.font,
        color: ink,
        background: '#fff',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {theme.headerBand ? (
        <div style={{ height: 4, background: theme.bandColor || theme.accent, marginBottom: 0 }} />
      ) : null}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: theme.outerBorder || border,
          tableLayout: 'fixed',
        }}
      >
        <tbody>
          <tr>
            <td
              style={cell({
                padding: theme.darkLetterhead ? '8px 8px' : '6px 8px',
                textAlign: 'center',
                background: theme.letterheadBg,
                borderBottom: theme.darkLetterhead ? `3px solid ${theme.accent}` : border,
              })}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  lineHeight: 1.15,
                  color: headInk,
                }}
              >
                {firmDisplay || '\u00a0'}
              </div>
              {(company.addressFull || company.address) ? (
                <div style={{ fontSize: 8, marginTop: 2, lineHeight: 1.35, color: headInk, opacity: 0.95 }}>
                  {company.addressFull || company.address}
                </div>
              ) : null}
              {(company.phone || company.email) ? (
                <div style={{ fontSize: 8, marginTop: 2, color: headInk }}>
                  {company.phone ? `(Ph) : ${company.phone}` : ''}
                  {company.email ? `  ·  ${company.email}` : ''}
                </div>
              ) : null}
              {(company.gstin || company.pan) ? (
                <div style={{ fontSize: 9, fontWeight: 800, marginTop: 2, color: headInk }}>
                  {company.gstin ? `GSTIN : ${company.gstin}` : ''}
                  {company.pan ? `  ·  PAN : ${company.pan}` : ''}
                </div>
              ) : null}
            </td>
          </tr>

          <tr>
            <td style={cell({ padding: '4px 6px' })}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '18%' }}>
                      {theme.titleBar ? (
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 800,
                            letterSpacing: '0.1em',
                            border: `1px solid ${theme.accent}`,
                            padding: '2px 6px',
                            color: theme.accent,
                          }}
                        >
                          {data.copyLabel}
                        </span>
                      ) : null}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontSize: 13,
                        fontWeight: 900,
                        letterSpacing: '0.14em',
                        color: theme.accent,
                      }}
                    >
                      {data.docTitle}
                    </td>
                    <td style={{ width: '40%', textAlign: 'right', fontSize: 10, fontWeight: 700 }}>
                      Place of Supply : {meta.placeOfSupplyLabel || meta.placeOfSupply || ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={{ padding: 0, border }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    {partyCell('Billed to (Customer)', billTo)}
                    {partyCell('Delivery Address', ship)}
                    <td style={cell({ width: '32%' })}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {invLine('Invoice No.', meta.invoiceNo)}
                          {invLine('Invoice Date', meta.date)}
                          {invLine('Challan No.', meta.challanNo)}
                          {invLine('Due Date', meta.dueDate)}
                          {invLine('Order No.', meta.orderNo)}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={{ padding: 0, border }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    {tf('Agent', meta.broker, '30%')}
                    {tf('Address', meta.brokerAddress, '45%')}
                    {tf('Haste', meta.haste, '25%')}
                  </tr>
                  <tr>
                    {tf('Transport', meta.transport, '22%')}
                    {tf('Station', meta.station, '18%')}
                    {tf('L.R. No.', meta.lrNo, '20%')}
                    {tf('L.R. Dt.', meta.lrDate, '20%')}
                    {tf('Case No', meta.baleNo, '20%')}
                  </tr>
                  <tr>
                    {tf('Freight', num(meta.freight), '25%')}
                    {tf('Weight', num(meta.weight, 3), '25%')}
                    {tf('E-Way', meta.eway, '25%')}
                    {tf('RCM', meta.reverseCharge, '25%')}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={{ padding: 0, border }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={th({ width: '5%' })}>Sr</th>
                    <th style={th({ width: '34%', textAlign: 'left' })}>Description of Goods</th>
                    <th style={th({ width: '12%' })}>HSN CODE</th>
                    <th style={th({ width: '8%' })}>Pcs</th>
                    <th style={th({ width: '12%' })}>{qtyLabel}</th>
                    <th style={th({ width: '12%' })}>Rate</th>
                    <th style={th({ width: '17%' })}>Amount Rs.</th>
                  </tr>
                </thead>
                <tbody>
                  {(lines.length ? lines : [{ empty: true }]).map((line, idx) => {
                    const descExtra =
                      line.desc &&
                      String(line.desc).trim() &&
                      String(line.desc).trim().toLowerCase() !== String(line.name || '').toLowerCase() &&
                      !/^\d+(\.\d+)?$/.test(String(line.desc).trim())
                        ? String(line.desc).trim()
                        : '';
                    return (
                      <tr key={idx}>
                        <td style={cell({ textAlign: 'center', height: 22 })}>
                          {line.empty ? '' : line.sno}
                        </td>
                        <td style={cell({ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' })}>
                          {line.empty ? '\u00a0' : line.name}
                          {descExtra ? (
                            <div style={{ fontWeight: 400, fontSize: 8, textTransform: 'none' }}>
                              {descExtra}
                            </div>
                          ) : null}
                        </td>
                        <td style={cell({ textAlign: 'center' })}>{line.empty ? '' : line.hsn || ''}</td>
                        <td style={cell({ textAlign: 'right' })}>
                          {line.empty ? '' : line.pcs ? num(line.pcs, 0) : ''}
                        </td>
                        <td style={cell({ textAlign: 'right' })}>
                          {line.empty ? '' : line.mts ? num(line.mts, 3) : ''}
                        </td>
                        <td style={cell({ textAlign: 'right' })}>
                          {line.empty ? '' : num(line.rate)}
                        </td>
                        <td style={cell({ textAlign: 'right', fontWeight: 700 })}>
                          {line.empty ? '' : num(line.taxable ?? line.amount)}
                        </td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: emptyPad }).map((_, i) => (
                    <tr key={`e-${i}`}>
                      <td style={cell({ height: 18 })}>&nbsp;</td>
                      <td style={cell()}>&nbsp;</td>
                      <td style={cell()}>&nbsp;</td>
                      <td style={cell()}>&nbsp;</td>
                      <td style={cell()}>&nbsp;</td>
                      <td style={cell()}>&nbsp;</td>
                      <td style={cell()}>&nbsp;</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={cell({ fontWeight: 700 })} colSpan={3}>
                      Total
                    </td>
                    <td style={cell({ textAlign: 'right', fontWeight: 800 })}>
                      {num(lineTotals?.pcs || 0, 0)}
                    </td>
                    <td style={cell({ textAlign: 'right', fontWeight: 800 })}>
                      {num(lineTotals?.mts || 0, 3)}
                    </td>
                    <td style={cell()} />
                    <td style={cell({ textAlign: 'right', fontWeight: 800 })}>
                      {num(lineTotals?.amount || totals.taxable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr className="invoice-avoid-break">
            <td style={{ padding: 0, border }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    <td style={cell({ width: '30%', borderRight: border })}>
                      <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 6 }}>
                        {meta.paymentTerms}
                      </div>
                      <div style={{ fontSize: 9, lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 800, marginBottom: 3, color: theme.accent }}>
                          Bank Details for RTGS / NEFT
                        </div>
                        {hasBank ? (
                          <>
                            <div>
                              Bank : {bank.bankName || ''}
                              {bank.branch ? `, ${bank.branch}` : ''}
                            </div>
                            <div>IFSC Code : {bank.ifsc || ''}</div>
                            <div>A/c No. : {bank.accountNo || ''}</div>
                            {bank.accountName ? <div>A/c Name : {bank.accountName}</div> : null}
                          </>
                        ) : (
                          <div style={{ minHeight: 36 }}>&nbsp;</div>
                        )}
                      </div>
                    </td>

                    <td style={{ width: '45%', padding: 0, borderRight: border, verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={th({ width: '11%' })}>Tax %</th>
                            <th style={th({ width: '17%' })}>Tax Value</th>
                            <th style={th({ width: '11%' })}>CGST %</th>
                            <th style={th({ width: '15%' })}>CGST Amt</th>
                            <th style={th({ width: '11%' })}>SGST %</th>
                            <th style={th({ width: '15%' })}>SGST Amt</th>
                            <th style={th({ width: '20%' })}>TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(taxRows?.length ? taxRows : [row]).map((r, i) => (
                            <tr key={i}>
                              <td style={taxCell({ textAlign: 'center' })}>{num(r.taxPct)}</td>
                              <td style={taxCell()}>{num(r.taxValue)}</td>
                              <td style={taxCell({ textAlign: 'center' })}>
                                {isIgst ? '' : num(r.cgstPct || 0)}
                              </td>
                              <td style={taxCell()}>{isIgst ? '' : num(r.cgstAmt || 0)}</td>
                              <td style={taxCell({ textAlign: 'center' })}>
                                {isIgst ? '' : num(r.sgstPct || 0)}
                              </td>
                              <td style={taxCell()}>{isIgst ? '' : num(r.sgstAmt || 0)}</td>
                              <td style={taxCell({ fontWeight: 700 })}>{num(r.total)}</td>
                            </tr>
                          ))}
                          {isIgst ? (
                            <tr>
                              <td style={taxCell({ textAlign: 'center' })} colSpan={2}>
                                IGST {num(row.igstPct || row.taxPct)}%
                              </td>
                              <td style={taxCell()} colSpan={4}>
                                IGST Amt : {num(totals.igst)}
                              </td>
                              <td style={taxCell({ fontWeight: 700 })}>
                                {num(Number(totals.taxable || 0) + Number(totals.gst || 0))}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </td>

                    <td style={cell({ width: '25%' })}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                          fontSize: 10,
                        }}
                      >
                        <span>+ GST Amount</span>
                        <b>{num(totals.gst)}</b>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                          fontSize: 10,
                        }}
                      >
                        <span>Round off</span>
                        <b>{num(totals.roundOff)}</b>
                      </div>
                      <div
                        style={{
                          border: `2px solid ${theme.accent}`,
                          background: theme.thBg,
                          padding: '6px 8px',
                          fontWeight: 900,
                          fontSize: 12,
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span>Net Amount Rs.</span>
                        <span>{num(totals.grandTotal)}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style={cell({ fontSize: 10, fontWeight: 700, padding: '6px 8px' })}>
              {totals.amountWords}
            </td>
          </tr>

          <tr className="invoice-avoid-break">
            <td style={{ padding: 0, border }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    <td style={cell({ width: '65%', fontSize: 8, lineHeight: 1.4, borderRight: border })}>
                      <div style={{ fontWeight: 800, fontSize: 9, marginBottom: 4 }}>
                        Terms &amp; Conditions :
                      </div>
                      <ol style={{ margin: 0, paddingLeft: 16 }}>
                        {(termsList || []).map((t, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>
                            {t}
                          </li>
                        ))}
                      </ol>
                      {meta.remarks ? (
                        <div style={{ marginTop: 6, fontSize: 9 }}>
                          <b>Remarks :</b> {meta.remarks}
                        </div>
                      ) : null}
                    </td>
                    <td style={cell({ width: '35%', textAlign: 'right', minHeight: 90 })}>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>E. &amp; O.E.</div>
                      <div style={{ fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                        {firmDisplay ? `For ${firmDisplay}` : 'For ________________'}
                      </div>
                      <div style={{ height: 48 }} />
                      <div
                        style={{
                          borderTop: border,
                          paddingTop: 4,
                          textAlign: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        Authorised Signatory
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
