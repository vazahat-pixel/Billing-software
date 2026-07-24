import React from 'react';
import { CompanyLogo } from '../shared/Blocks';
import { UpiQr } from '../shared/BankBlock';

const INK = '#000';
const MUTED = '#333';
const BORDER = '1px solid #000';
const FONT = 'Arial, Helvetica, sans-serif';

/**
 * Professional GST Tax Invoice — table layout (print-safe, no flex gaps).
 * Content hugs the border; no forced full-page empty middle.
 */
export default function GstFormal({ data }) {
  const { company, meta, billTo, shipTo, isSale, isIgst, fmt, lines, totals, bank, terms } = data;
  const ship = shipTo || billTo;
  const pos =
    meta.placeOfSupplyCode && meta.placeOfSupply && meta.placeOfSupply !== '—'
      ? `${String(meta.placeOfSupplyCode).padStart(2, '0')} - ${meta.placeOfSupply}`
      : meta.placeOfSupply || '—';
  const taxPct = data.gstRate || 0;
  const words = String(totals.amountWords || '')
    .replace(/^Indian Rupees\s+/i, 'Rs. ')
    .replace(/^Zero Rupees/i, 'Rs. Zero');
  const hasBank = !!(bank?.bankName || bank?.accountNo || bank?.ifsc);
  const firmName = company.name && company.name !== 'Company' ? company.name : 'Your Company Name';

  const td = (extra = {}) => ({
    border: BORDER,
    padding: '3px 5px',
    fontSize: 9,
    verticalAlign: 'top',
    color: INK,
    ...extra,
  });

  const partyCell = (title, p) => (
    <td style={td({ width: '50%' })}>
      <div style={{ fontWeight: 800, fontSize: 9, borderBottom: BORDER, marginBottom: 4, paddingBottom: 2, display: 'inline-block' }}>
        {title}
      </div>
      <div style={{ lineHeight: 1.4, fontSize: 9 }}>
        <div>
          <span style={{ color: MUTED }}>Name</span> : <b>{p?.name || '—'}</b>
        </div>
        <div>
          <span style={{ color: MUTED }}>GSTIN</span> : <b>{p?.gstin || 'Unregistered'}</b>
        </div>
        {p?.phone ? (
          <div>
            <span style={{ color: MUTED }}>Mobile</span> : {p.phone}
          </div>
        ) : null}
        <div>
          <span style={{ color: MUTED }}>Address</span> :{' '}
          {[p?.address, p?.state, p?.stateCode ? `(${p.stateCode})` : ''].filter(Boolean).join(', ') || '—'}
        </div>
      </div>
    </td>
  );

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
          border: '2px solid #000',
          tableLayout: 'fixed',
        }}
      >
        <tbody>
          {/* Title row */}
          <tr>
            <td colSpan={2} style={td({ padding: '4px 6px', fontSize: 8 })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Page 1 of 1</span>
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.12em' }}>{data.docTitle}</span>
                <span>{data.copyLabel === 'ORIGINAL' ? 'Original Copy' : data.copyLabel}</span>
              </div>
            </td>
          </tr>

          {/* Letterhead */}
          <tr>
            <td colSpan={2} style={td({ padding: '6px 8px' })}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: BORDER,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {company.showLogo && company.logoUrl ? (
                    <CompanyLogo company={company} size={46} accent={INK} />
                  ) : (
                    <span style={{ fontSize: 7, color: '#888' }}>LOGO</span>
                  )}
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>{firmName}</div>
                  <div style={{ fontSize: 8, color: MUTED, marginTop: 2, lineHeight: 1.35 }}>
                    {[company.address, company.area].filter(Boolean).join(', ') || 'Add company address in Settings'}
                  </div>
                  <div style={{ fontSize: 8, marginTop: 2 }}>
                    {[company.phone ? `Mobile: ${company.phone}` : null, company.email ? `Email: ${company.email}` : null]
                      .filter(Boolean)
                      .join(' | ') || 'Mobile: —'}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, marginTop: 2 }}>
                    GSTIN - {company.gstin || '—'}
                    {company.pan ? ` | PAN - ${company.pan}` : ''}
                  </div>
                </div>
              </div>
            </td>
          </tr>

          {/* Invoice meta | Transport */}
          <tr>
            <td style={td({ width: '50%', lineHeight: 1.45 })}>
              <Meta line="Invoice Number" value={meta.invoiceNo} />
              <Meta line="Invoice Date" value={meta.date} />
              {meta.dueDate ? <Meta line="Due Date" value={meta.dueDate} /> : null}
              <Meta line="Place of Supply" value={pos} />
              <Meta line="Reverse Charge" value={meta.reverseCharge === 'Y' ? 'Yes' : 'No'} />
              {!isSale && meta.supplierInvoiceNo ? <Meta line="Supplier Bill" value={meta.supplierInvoiceNo} /> : null}
            </td>
            <td style={td({ width: '50%', lineHeight: 1.45 })}>
              <Meta line="Transporter" value={meta.transport || '—'} />
              <Meta line="Vehicle / LR No." value={meta.lrNo || '—'} />
              <Meta line="Station" value={meta.station || '—'} />
              <Meta line="E-Way Bill No." value={meta.eway || '—'} />
              {meta.orderNo ? <Meta line="Order No." value={meta.orderNo} /> : null}
              {meta.challanNo ? <Meta line="Challan No." value={meta.challanNo} /> : null}
            </td>
          </tr>

          {/* Billing | Shipping */}
          <tr>
            {partyCell('Billing Details', billTo)}
            {partyCell('Shipping Details', ship)}
          </tr>

          {(meta.irn || meta.ackNo) && (
            <tr>
              <td colSpan={2} style={td({ fontSize: 8, background: '#f7f7f7' })}>
                {meta.irn ? (
                  <span style={{ marginRight: 14 }}>
                    <b>IRN:</b> {meta.irn}
                  </span>
                ) : null}
                {meta.ackNo ? (
                  <span style={{ marginRight: 14 }}>
                    <b>Ack No.:</b> {meta.ackNo}
                  </span>
                ) : null}
                {meta.ackDate ? (
                  <span>
                    <b>Ack Date:</b> {meta.ackDate}
                  </span>
                ) : null}
              </td>
            </tr>
          )}

          {/* Items */}
          <tr>
            <td colSpan={2} style={{ padding: 0, border: BORDER }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    {['Sr.', 'Item Description', 'HSN/SAC', 'Qty', 'Unit', 'List Price', 'Disc.', 'Tax %', 'Amount (₹)'].map(
                      (h, i) => (
                        <th
                          key={h}
                          style={{
                            ...td({
                              fontWeight: 800,
                              fontSize: 8,
                              textAlign: i === 1 ? 'left' : i >= 3 && i !== 4 && i !== 7 ? 'right' : 'center',
                              background: '#eee',
                              padding: '4px 3px',
                            }),
                            width: ['5%', '28%', '10%', '9%', '7%', '11%', '8%', '7%', '15%'][i],
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(lines.length ? lines : [{ sno: 1, name: '—', empty: true }]).map((line, idx) => (
                    <tr key={idx}>
                      <td style={td({ textAlign: 'center' })}>{line.sno}</td>
                      <td style={td({ fontWeight: 600 })}>
                        {line.empty ? ' ' : line.name}
                        {line.desc ? <div style={{ fontWeight: 400, fontSize: 8, color: MUTED }}>{line.desc}</div> : null}
                      </td>
                      <td style={td({ textAlign: 'center' })}>{line.empty ? ' ' : line.hsn || '—'}</td>
                      <td style={td({ textAlign: 'right' })}>
                        {line.empty ? ' ' : fmt.num(line.qty || line.mts || line.pcs)}
                      </td>
                      <td style={td({ textAlign: 'center' })}>{line.empty ? ' ' : line.unit || '—'}</td>
                      <td style={td({ textAlign: 'right' })}>{line.empty ? ' ' : fmt.num(line.rate)}</td>
                      <td style={td({ textAlign: 'right' })}>
                        {line.empty ? ' ' : line.discount ? fmt.num(line.discount) : '—'}
                      </td>
                      <td style={td({ textAlign: 'center' })}>{line.empty ? ' ' : taxPct ? `${taxPct}%` : '—'}</td>
                      <td style={td({ textAlign: 'right', fontWeight: 700 })}>
                        {line.empty ? ' ' : fmt.num(line.total)}
                      </td>
                    </tr>
                  ))}
                  {totals.discount > 0 && (
                    <tr>
                      <td colSpan={8} style={td({ textAlign: 'right', fontWeight: 700 })}>
                        Discount
                      </td>
                      <td style={td({ textAlign: 'right' })}>− {fmt.num(totals.discount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={8} style={td({ textAlign: 'right', fontWeight: 900, background: '#eee' })}>
                      Total
                    </td>
                    <td style={td({ textAlign: 'right', fontWeight: 900, background: '#eee', fontSize: 11 })}>
                      {fmt.num(totals.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Amount in words */}
          <tr>
            <td colSpan={2} style={td({ fontSize: 9 })}>
              <b>Amount in Words:</b> {words}
              <span style={{ float: 'right' }}>
                <b>Balance:</b> {fmt.money(totals.grandTotal)}
              </span>
            </td>
          </tr>

          {/* Tax summary */}
          <tr>
            <td colSpan={2} style={td({ fontSize: 8, background: '#f7f7f7', lineHeight: 1.4 })}>
              Sale @{taxPct || 0}% = {fmt.num(totals.taxable)}
              {!isIgst ? (
                <>
                  , CGST = {fmt.num(totals.cgst)}, SGST = {fmt.num(totals.sgst)}
                </>
              ) : (
                <>, IGST = {fmt.num(totals.igst)}</>
              )}
              {' | '}
              Total Sale = {fmt.num(totals.taxable)}, Tax = {fmt.num(totals.gst)}, Cess = 0.00
              {totals.roundOff !== 0 ? `, Round Off = ${fmt.num(totals.roundOff)}` : ''}
            </td>
          </tr>

          {/* Footer 3-col */}
          <tr>
            <td colSpan={2} style={{ padding: 0, border: BORDER }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    <td style={td({ width: '34%', fontSize: 8, lineHeight: 1.35, borderRight: BORDER })}>
                      <div style={{ fontWeight: 800, marginBottom: 3 }}>Terms and Conditions</div>
                      <div>E &amp; O.E</div>
                      <div style={{ color: MUTED, marginTop: 2 }}>{terms}</div>
                      {meta.remarks ? (
                        <div style={{ marginTop: 4 }}>
                          <b>Remarks:</b> {meta.remarks}
                        </div>
                      ) : null}
                    </td>
                    <td style={td({ width: '38%', fontSize: 8, lineHeight: 1.35, borderRight: BORDER })}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {bank?.upiId ? (
                          <div style={{ textAlign: 'center' }}>
                            <UpiQr
                              upiId={bank.upiId}
                              payeeName={bank.accountName}
                              amount={totals.grandTotal}
                              size={58}
                            />
                            <div style={{ fontSize: 7, fontWeight: 700 }}>Payment QR</div>
                          </div>
                        ) : null}
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 3 }}>Bank Details</div>
                          {hasBank ? (
                            <>
                              <div>A/c: {bank.accountNo || '—'}</div>
                              <div>Bank: {bank.bankName || '—'}</div>
                              <div>IFSC: {bank.ifsc || '—'}</div>
                              <div>Branch: {bank.branch || '—'}</div>
                              <div>Name: {bank.accountName || firmName}</div>
                            </>
                          ) : (
                            <div style={{ color: '#888' }}>Bank details not set</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={td({ width: '28%', height: 90, position: 'relative' })}>
                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 9 }}>For {firmName}</div>
                      <div
                        style={{
                          position: 'absolute',
                          left: 8,
                          right: 8,
                          bottom: 8,
                          borderTop: BORDER,
                          paddingTop: 3,
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: 8,
                        }}
                      >
                        Signature
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td colSpan={2} style={td({ textAlign: 'center', fontSize: 7, color: '#666', padding: '2px 4px' })}>
              Computer-generated tax invoice · {firmName}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Meta({ line, value }) {
  return (
    <div style={{ marginBottom: 2, fontSize: 9 }}>
      <span style={{ color: MUTED }}>{line}</span>
      <span style={{ margin: '0 4px', color: '#999' }}>:</span>
      <b>{value || '—'}</b>
    </div>
  );
}
