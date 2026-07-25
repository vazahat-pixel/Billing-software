import React from 'react';

const INK = '#000';
const BORDER = '1px solid #000';
const FONT = 'Arial, Helvetica, sans-serif';

/**
 * Textile Tax Invoice — clean A4 print (no overlap, full page width).
 */
export default function GstFormal({ data }) {
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

  const ship = shipTo || billTo;
  const firmName =
    company.name && company.name !== 'Company' ? String(company.name).toUpperCase() : 'YOUR COMPANY NAME';
  const hasBank = !!(bank?.bankName || bank?.accountNo || bank?.ifsc);
  const qtyLabel = (lines || []).some((l) => /KG/i.test(String(l.unit || ''))) ? 'Kgs' : 'Mts';
  // Few blank rows only — too many empty rows force browser to shrink-to-fit and overlap
  const emptyPad = Math.max(0, 3 - (lines?.length || 0));

  const cell = (extra = {}) => ({
    border: BORDER,
    padding: '4px 5px',
    fontSize: 10,
    verticalAlign: 'top',
    color: INK,
    lineHeight: 1.35,
    ...extra,
  });

  const th = (extra = {}) =>
    cell({
      fontWeight: 700,
      fontSize: 9,
      textAlign: 'center',
      verticalAlign: 'middle',
      background: '#f5f5f5',
      ...extra,
    });

  const num = (n, digits = 2) =>
    (Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  const partyCell = (title, p) => (
    <td style={cell({ width: '34%' })}>
      <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>
        {p?.name || ''}
      </div>
      {(p?.addressLines || []).map((line, i) => (
        <div key={i} style={{ fontSize: 9 }}>
          {line}
        </div>
      ))}
      {!p?.addressLines?.length && p?.address ? <div style={{ fontSize: 9 }}>{p.address}</div> : null}
      <div style={{ fontSize: 9, marginTop: 3 }}>GSTIN : {p?.gstin || ''}</div>
      <div style={{ fontSize: 9 }}>State : {p?.stateLabel || p?.state || ''}</div>
    </td>
  );

  const invLine = (label, value) => (
    <tr>
      <td style={{ fontSize: 10, padding: '2px 0', width: 96, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ fontSize: 10, padding: '2px 0', fontWeight: 700 }}>: {value || ''}</td>
    </tr>
  );

  const tf = (label, value, w) => (
    <td style={cell({ width: w })}>
      <span style={{ whiteSpace: 'nowrap' }}>{label} : </span>
      <b>{value || ''}</b>
    </td>
  );

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
      className="invoice-template gst-formal"
      style={{
        fontFamily: FONT,
        color: INK,
        background: '#fff',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: BORDER,
          tableLayout: 'fixed',
        }}
      >
        <tbody>
          {/* Letterhead */}
          <tr>
            <td style={cell({ padding: '8px 8px', textAlign: 'center' })}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.15 }}>
                {firmName}
              </div>
              <div style={{ fontSize: 9, marginTop: 3, lineHeight: 1.35 }}>
                {company.addressFull || company.address || ''}
              </div>
              <div style={{ fontSize: 9, marginTop: 2 }}>
                {company.phone ? `(Ph) : ${company.phone}` : ''}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2 }}>
                GSTIN : {company.gstin || ''}
              </div>
            </td>
          </tr>

          {/* Title */}
          <tr>
            <td style={cell({ padding: '4px 6px' })}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '20%' }} />
                    <td
                      style={{
                        textAlign: 'center',
                        fontSize: 13,
                        fontWeight: 900,
                        letterSpacing: '0.14em',
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

          {/* Party + meta */}
          <tr>
            <td style={{ padding: 0, border: BORDER }}>
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

          {/* Transport */}
          <tr>
            <td style={{ padding: 0, border: BORDER }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    {tf('Agent', meta.broker, '28%')}
                    {tf('Address', meta.brokerAddress, '44%')}
                    {tf('Haste', meta.haste, '28%')}
                  </tr>
                  <tr>
                    {tf('Transport', meta.transport, '16%')}
                    {tf('Station', meta.station, '14%')}
                    {tf('L.R. No.', meta.lrNo, '14%')}
                    {tf('L.R. Dt.', meta.lrDate, '14%')}
                    {tf('Case No', meta.baleNo, '12%')}
                    {tf('Freight', num(meta.freight), '15%')}
                    {tf('Weight', num(meta.weight, 3), '15%')}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Items */}
          <tr>
            <td style={{ padding: 0, border: BORDER }}>
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

          {/* Bank + Tax + Net — single clean row, no absolute / nested crush */}
          <tr className="invoice-avoid-break">
            <td style={{ padding: 0, border: BORDER }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    <td style={cell({ width: '30%', borderRight: BORDER })}>
                      <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 6 }}>
                        {meta.paymentTerms}
                      </div>
                      <div style={{ fontSize: 9, lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 800, marginBottom: 3 }}>
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
                          </>
                        ) : (
                          <div style={{ color: '#555' }}>Set bank in Company Settings</div>
                        )}
                      </div>
                    </td>

                    <td style={{ width: '45%', padding: 0, borderRight: BORDER, verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={th({ width: '12%' })}>Tax %</th>
                            <th style={th({ width: '18%' })}>Tax Value</th>
                            <th style={th({ width: '12%' })}>CGST %</th>
                            <th style={th({ width: '14%' })}>CGST Amt</th>
                            <th style={th({ width: '12%' })}>SGST %</th>
                            <th style={th({ width: '14%' })}>SGST Amt</th>
                            <th style={th({ width: '18%' })}>TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={cell({ textAlign: 'center' })}>{num(row.taxPct)}</td>
                            <td style={cell({ textAlign: 'right' })}>{num(row.taxValue)}</td>
                            <td style={cell({ textAlign: 'center' })}>
                              {isIgst ? '' : num(row.cgstPct || 0)}
                            </td>
                            <td style={cell({ textAlign: 'right' })}>
                              {isIgst ? '' : num(row.cgstAmt || 0)}
                            </td>
                            <td style={cell({ textAlign: 'center' })}>
                              {isIgst ? '' : num(row.sgstPct || 0)}
                            </td>
                            <td style={cell({ textAlign: 'right' })}>
                              {isIgst ? '' : num(row.sgstAmt || 0)}
                            </td>
                            <td style={cell({ textAlign: 'right', fontWeight: 700 })}>
                              {num(row.total)}
                            </td>
                          </tr>
                          {isIgst ? (
                            <tr>
                              <td style={cell({ textAlign: 'center' })} colSpan={2}>
                                IGST {num(row.igstPct || row.taxPct)}%
                              </td>
                              <td style={cell({ textAlign: 'right' })} colSpan={4}>
                                IGST Amt : {num(row.igstAmt || totals.igst)}
                              </td>
                              <td style={cell({ textAlign: 'right', fontWeight: 700 })}>
                                {num(row.total)}
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
                          border: '2px solid #000',
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

          {/* Amount in words — own row, clear separation */}
          <tr>
            <td style={cell({ fontSize: 10, fontWeight: 700, padding: '6px 8px' })}>
              {totals.amountWords}
            </td>
          </tr>

          {/* Terms + signature — no absolute positioning */}
          <tr className="invoice-avoid-break">
            <td style={{ padding: 0, border: BORDER }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    <td style={cell({ width: '65%', fontSize: 8, lineHeight: 1.4, borderRight: BORDER })}>
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
                      <div style={{ fontSize: 11, fontWeight: 800, marginTop: 4 }}>For {firmName}</div>
                      <div style={{ height: 48 }} />
                      <div
                        style={{
                          borderTop: BORDER,
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
