/**
 * Textile Pro — Classic Surat GST Tax Invoice
 * Full bordered grid matching HARSHIKA TEX FAB reference layout.
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import ClassicItemTable from '../engine/primitives/ClassicItemTable';
import { classicGridStyles } from '../engine/styles/classicGrid.css';
import { addressLines } from '../engine/utils';

function Field({ label, value, bold }) {
  return (
    <div style={{ marginBottom: '1mm' }}>
      <span className="ipe-classic-label">{label}: </span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{value || '\u00A0'}</span>
    </div>
  );
}

function PartyBlock({ title, party }) {
  const lines = addressLines(party);
  return (
    <>
      <div className="ipe-classic-label" style={{ marginBottom: '1.5mm' }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: '9.5pt', marginBottom: '1mm' }}>{party?.name}</div>
      {lines.map((l) => (
        <div key={l} style={{ lineHeight: 1.35, fontSize: '8.5pt' }}>{l}</div>
      ))}
      <div style={{ marginTop: '2mm', fontSize: '8.5pt' }}>
        <div><span className="ipe-classic-label">GSTIN: </span>{party?.gstin || ''}</div>
        <div style={{ marginTop: '0.5mm' }}><span className="ipe-classic-label">State: </span>{party?.stateLabel || ''}</div>
      </div>
    </>
  );
}

function TextileTaxGrid({ data }) {
  const { taxRows, fmt, isIgst, totals } = data;
  const money = (n) => fmt.money(n).replace(/^₹\s*/, '');

  if (!taxRows?.length) return null;
  const row = taxRows[0];

  return (
    <table className="ipe-classic-grid" style={{ fontSize: '7pt' }}>
      <thead>
        <tr>
          <th>Tax (%)</th>
          <th>Tax. Value (Rs.)</th>
          <th>CGST (%)</th>
          <th>CGST Amount</th>
          <th>UT/SGST (%)</th>
          <th>UT/SGST Amount</th>
          <th>IGST (%)</th>
          <th>IGST Amount</th>
          <th>CESS (%)</th>
          <th>CESS Amount</th>
          <th>TOTAL Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="ipe-num" style={{ textAlign: 'center' }}>{row.taxPct}%</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{money(row.taxValue)}</td>
          <td className="ipe-num" style={{ textAlign: 'center' }}>{isIgst ? '' : `${row.cgstPct}%`}</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{isIgst ? '' : money(row.cgstAmt)}</td>
          <td className="ipe-num" style={{ textAlign: 'center' }}>{isIgst ? '' : `${row.sgstPct}%`}</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{isIgst ? '' : money(row.sgstAmt)}</td>
          <td className="ipe-num" style={{ textAlign: 'center' }}>{isIgst ? `${row.igstPct}%` : ''}</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{isIgst ? money(row.igstAmt) : ''}</td>
          <td className="ipe-num" style={{ textAlign: 'center' }}>{row.cessPct ? `${row.cessPct}%` : ''}</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{row.cessAmt ? money(row.cessAmt) : ''}</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{money(row.cgstAmt + row.sgstAmt + row.igstAmt + (row.cessAmt || 0))}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={9} style={{ border: 'none', borderRight: '1px solid #000' }}>&nbsp;</td>
          <td style={{ fontWeight: 700, textAlign: 'right', fontSize: '8pt' }}>Gross Amount</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{money(totals.grossAmount)}</td>
        </tr>
        {totals.foldLess ? (
          <tr>
            <td colSpan={9} style={{ border: 'none', borderRight: '1px solid #000' }}>&nbsp;</td>
            <td style={{ fontWeight: 700, textAlign: 'right', fontSize: '8pt' }}>- Fold Less</td>
            <td className="ipe-num" style={{ textAlign: 'right' }}>{money(totals.foldLess)}</td>
          </tr>
        ) : null}
        <tr>
          <td colSpan={9} style={{ border: 'none', borderRight: '1px solid #000' }}>&nbsp;</td>
          <td style={{ fontWeight: 700, textAlign: 'right', fontSize: '8pt' }}>+ GST Amount</td>
          <td className="ipe-num" style={{ textAlign: 'right', fontWeight: 700 }}>{money(totals.gst)}</td>
        </tr>
        <tr>
          <td colSpan={9} style={{ border: 'none', borderRight: '1px solid #000' }}>&nbsp;</td>
          <td style={{ fontWeight: 700, textAlign: 'right', fontSize: '8pt' }}>Round off</td>
          <td className="ipe-num" style={{ textAlign: 'right' }}>{money(totals.roundOff || 0)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function TextilePro({ data }) {
  const { company, meta, billTo, shipTo, totals, fmt, bank, termsList } = data;
  const delivery = shipTo?.name !== billTo?.name ? shipTo : billTo;

  return (
    <InvoicePrintRoot templateId="textile-pro" data={data} showFooter={false}>
      <style>{classicGridStyles}</style>

      <div className="ipe-classic-doc">
        {/* ── Letterhead ── */}
        <div style={{ textAlign: 'center', padding: '3mm 4mm 2mm', borderBottom: '1px solid #000' }}>
          <div style={{ fontSize: '8pt', letterSpacing: '0.15em' }}>|| Shree Ganeshay Namah ||</div>
          <div className="ipe-classic-header-name" style={{ marginTop: '1mm' }}>{company?.name}</div>
          <div style={{ fontSize: '8.5pt', marginTop: '1.5mm', lineHeight: 1.4 }}>
            {[company?.addressFull || company?.address, company?.area].filter(Boolean).join(' ')}
          </div>
          {company?.phone ? <div style={{ fontSize: '8.5pt', marginTop: '1mm' }}>(Ph): {company.phone}</div> : null}
          {company?.gstin ? <div style={{ fontSize: '9pt', fontWeight: 700, marginTop: '1mm' }}>{company.gstin}</div> : null}
        </div>

        {/* ── TAX INVOICE bar ── */}
        <table className="ipe-classic-grid ipe-classic-title-bar" style={{ border: 'none', borderBottom: '1px solid #000' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', borderTop: 'none', borderLeft: 'none' }}>{data.docTitle}</td>
              <td style={{ width: '50%', textAlign: 'right', borderTop: 'none', borderRight: 'none' }}>
                Place of Supply : {meta.placeOfSupplyLabel}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Billed to | Delivery | Invoice meta ── */}
        <table className="ipe-classic-grid">
          <tbody>
            <tr>
              <td style={{ width: '39%', verticalAlign: 'top' }}>
                <PartyBlock title="Billed to (Customer):" party={billTo} />
              </td>
              <td style={{ width: '39%', verticalAlign: 'top' }}>
                <PartyBlock title="Delivery Address:" party={delivery} />
              </td>
              <td style={{ width: '22%', verticalAlign: 'top', padding: '2mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
                  <tbody>
                    {[
                      ['Invoice No.', meta.invoiceNo],
                      ['Invoice Date', meta.date],
                      ['Challan No.', meta.challanNo],
                      ['Due Date', meta.dueDate],
                      ['Order No.', meta.orderNo],
                    ].map(([l, v]) => (
                      <tr key={l}>
                        <td style={{ padding: '0.8mm 0', whiteSpace: 'nowrap', fontWeight: 600 }}>{l}</td>
                        <td style={{ padding: '0.8mm 0 0.8mm 2mm', textAlign: 'right' }}>{v || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Transport / Agent ── */}
        <table className="ipe-classic-grid" style={{ fontSize: '8pt' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%' }}>
                <Field label="Agent" value={meta.broker} />
                <Field label="Address" value={meta.brokerAddress} />
                <Field label="Haste" value={meta.haste} />
              </td>
              <td style={{ width: '50%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 4mm' }}>
                  <Field label="Transport" value={meta.transport} />
                  <Field label="Station" value={meta.station} />
                  <Field label="L.R. No." value={meta.lrNo} />
                  <Field label="Case No" value={meta.baleNo} />
                  <Field label="L.R. Dt." value={meta.lrDate} />
                  <Field label="Freight" value={fmt.money(meta.freight || 0).replace(/^₹\s*/, '')} />
                  <div />
                  <Field label="Weight" value={meta.weight ? fmt.num(meta.weight) : '0.000'} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Items ── */}
        <ClassicItemTable data={data} paymentTerms={meta.paymentTerms} />

        {/* ── Bank Details & UPI QR Code ── */}
        <table className="ipe-classic-grid">
          <tbody>
            <tr>
              <td style={{ width: bank?.upiQrUrl ? '75%' : '100%', fontSize: '8.5pt', verticalAlign: 'middle' }}>
                <div>
                  <span className="ipe-classic-label">Bank Details: </span>
                  {bank?.bankName ? (
                    <>
                      <strong>{bank.bankName}</strong>{bank.branch ? `, ${bank.branch}` : ''}
                      {' · '}<strong>A/c No:</strong> {bank.accountNo || '—'}
                      {' · '}<strong>IFSC:</strong> {bank.ifsc || '—'}
                    </>
                  ) : (
                    <span style={{ color: '#666' }}>Bank account details available on request</span>
                  )}
                </div>
                {bank?.upiId && (
                  <div style={{ marginTop: '1mm', fontSize: '8pt' }}>
                    <span className="ipe-classic-label">UPI ID / VPA: </span>
                    <strong style={{ color: '#1e3a8a' }}>{bank.upiId}</strong>
                  </div>
                )}
              </td>
              {bank?.upiQrUrl && (
                <td style={{ width: '25%', textAlign: 'center', padding: '1mm', borderLeft: '1px solid #000' }}>
                  <img
                    src={bank.upiQrUrl}
                    alt="Scan & Pay UPI QR"
                    style={{ width: '24mm', height: '24mm', display: 'block', margin: '0 auto' }}
                  />
                  <div style={{ fontSize: '6.5pt', fontWeight: 700, marginTop: '0.5mm', color: '#1e3a8a' }}>
                    SCAN &amp; PAY VIA UPI
                  </div>
                </td>
              )}
            </tr>
          </tbody>
        </table>

        {/* ── Tax grid + GST totals ── */}
        <TextileTaxGrid data={data} />

        {/* ── Net Amount row ── */}
        <table className="ipe-classic-grid">
          <tbody>
            <tr>
              <td style={{ width: '68%', fontSize: '8.5pt', verticalAlign: 'middle' }}>
                <span className="ipe-classic-label">Amount Chargeable (in words): </span>
                <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{totals.amountWords}</span>
              </td>
              <td style={{ width: '32%', textAlign: 'right', fontWeight: 800, fontSize: '11pt', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '7.5pt', fontWeight: 700, color: '#475569', marginBottom: '0.5mm' }}>Net Payable Amount (Rs.)</div>
                <span className="ipe-num" style={{ fontSize: '12pt', color: '#0f172a' }}>{fmt.money(totals.grandTotal).replace(/^₹\s*/, '')}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Terms + Signature ── */}
        <table className="ipe-classic-grid ipe-avoid-break">
          <tbody>
            <tr>
              <td style={{ width: '62%', fontSize: '7.5pt', verticalAlign: 'top' }}>
                <div className="ipe-classic-label" style={{ marginBottom: '1.5mm' }}>Terms &amp; Conditions</div>
                <ol style={{ margin: 0, paddingLeft: '4mm' }}>
                  {(termsList || []).map((t) => (
                    <li key={t} style={{ marginBottom: '0.8mm', lineHeight: 1.4 }}>{t}</li>
                  ))}
                </ol>
              </td>
              <td style={{ width: '38%', textAlign: 'right', verticalAlign: 'bottom', fontSize: '8.5pt' }}>
                <div style={{ fontSize: '7.5pt' }}>E. &amp; O.E.</div>
                <div style={{ marginTop: '12mm', fontWeight: 700 }}>For {company?.name}</div>
                <div style={{ marginTop: '10mm', fontSize: '8pt', borderTop: '1px dashed #94a3b8', paddingTop: '1mm', display: 'inline-block' }}>Authorised Signatory</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </InvoicePrintRoot>
  );
}
