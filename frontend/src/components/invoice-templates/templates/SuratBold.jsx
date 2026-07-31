/**
 * Surat Bold — Professional Textile GST Invoice
 * Dark Navy Header Bar · Full Bordered Grid · Textile Fields
 * Complete GST/Tax information, Transport, Broker, Bank & UPI QR
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { addressLines } from '../engine/utils';

const NAVY = '#0f2f5a';
const NAVY_LIGHT = '#1a4a8a';
const GOLD = '#c9a84c';
const GOLD_LIGHT = '#f5e6a3';
const BORDER = '#1a3a6b';
const BG_LIGHT = '#f0f5ff';
const TEXT = '#0a1a2e';
const MUTED = '#4a6080';

const money = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function Lbl({ children }) {
  return (
    <span style={{ fontSize: '6.5pt', color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}
    </span>
  );
}

function Val({ children, bold }) {
  return (
    <span style={{ fontSize: '8pt', color: TEXT, fontWeight: bold ? 700 : 400 }}>
      {children || ''}
    </span>
  );
}

function FieldRow({ label, value, bold }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6mm 2mm', borderBottom: `0.3px solid #d0ddf0` }}>
      <Lbl>{label}</Lbl>
      <Val bold={bold}>{value}</Val>
    </div>
  );
}

function PartyCard({ title, party }) {
  const lines = addressLines(party);
  return (
    <div style={{ padding: '2mm 3mm', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '6.5pt', fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.5mm' }}>
        {title}
      </div>
      <div style={{ fontWeight: 800, fontSize: '9.5pt', color: '#fff', marginBottom: '1mm', lineHeight: 1.2 }}>
        {party?.name}
      </div>
      {lines.map((l) => (
        <div key={l} style={{ fontSize: '7.5pt', color: '#bdd0ec', lineHeight: 1.4 }}>{l}</div>
      ))}
      {party?.gstin && (
        <div style={{ marginTop: '1.5mm', fontSize: '7pt', color: GOLD_LIGHT }}>
          <strong>GSTIN:</strong> {party.gstin}
        </div>
      )}
      {party?.stateLabel && (
        <div style={{ fontSize: '7pt', color: '#bdd0ec' }}>
          <strong>State:</strong> {party.stateLabel}
        </div>
      )}
      {party?.phone && (
        <div style={{ fontSize: '7pt', color: '#bdd0ec', marginTop: '0.5mm' }}>
          <strong>Ph:</strong> {party.phone}
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: '1mm 2mm', background: '#fff', border: `0.5px solid #c0d0e8`, marginBottom: '0.8mm' }}>
      <div style={{ fontSize: '6pt', color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '8.5pt', fontWeight: 700, color: TEXT }}>{value}</div>
    </div>
  );
}

export default function SuratBold({ data }) {
  const { company, meta, billTo, shipTo, lines, totals, fmt, bank, termsList, taxRows, isIgst, hsnSummary } = data;
  const delivery = shipTo?.name !== billTo?.name ? shipTo : billTo;
  const totalPcs = (lines || []).reduce((s, l) => s + (Number(l.pcs) || 0), 0);
  const totalMts = (lines || []).reduce((s, l) => s + (Number(l.mts) || 0), 0);
  const totalAmt = (lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <InvoicePrintRoot templateId="surat-bold" data={data} showFooter={false}>
      <style>{`
        .sb-table { width: 100%; border-collapse: collapse; }
        .sb-table th { background: ${NAVY}; color: #fff; font-size: 7pt; font-weight: 700; padding: 1.5mm 1.5mm; text-align: center; border: 0.5px solid ${BORDER}; }
        .sb-table td { font-size: 7.5pt; padding: 1.2mm 1.5mm; border: 0.5px solid #c0d0e8; color: ${TEXT}; vertical-align: middle; }
        .sb-table tbody tr:nth-child(even) td { background: ${BG_LIGHT}; }
        .sb-table tfoot td { font-weight: 700; background: #e0eaff; border: 0.5px solid ${BORDER}; font-size: 7.5pt; }
        .sb-num { text-align: right; font-variant-numeric: tabular-nums; }
        .sb-center { text-align: center; }
      `}</style>

      {/* ── HEADER BAR ── */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`, padding: '4mm 5mm 3mm', borderBottom: `3px solid ${GOLD}` }}>
        {/* Deity line */}
        <div style={{ textAlign: 'center', fontSize: '7pt', color: GOLD_LIGHT, letterSpacing: '0.2em', marginBottom: '1.5mm' }}>
          ॥ श्री गणेशाय नमः ॥
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', alignItems: 'center' }}>
          {/* Company info */}
          <div>
            <div style={{ fontWeight: 900, fontSize: '15pt', color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              {company?.name}
            </div>
            <div style={{ fontSize: '7.5pt', color: '#a0c0f0', marginTop: '1mm', lineHeight: 1.5 }}>
              {[company?.addressFull || company?.address, company?.area].filter(Boolean).join(' ')}
            </div>
            <div style={{ display: 'flex', gap: '5mm', marginTop: '1.5mm', flexWrap: 'wrap' }}>
              {company?.phone && <span style={{ fontSize: '7pt', color: GOLD_LIGHT }}><strong>Ph:</strong> {company.phone}</span>}
              {company?.email && <span style={{ fontSize: '7pt', color: '#a0c0f0' }}>{company.email}</span>}
              {company?.gstin && <span style={{ fontSize: '7.5pt', color: GOLD, fontWeight: 800 }}>GSTIN: {company.gstin}</span>}
            </div>
          </div>

          {/* Doc type box */}
          <div style={{ textAlign: 'center', background: GOLD, padding: '2mm 5mm', border: `1px solid #e8c86a` }}>
            <div style={{ fontSize: '12pt', fontWeight: 900, color: NAVY, letterSpacing: '0.05em', lineHeight: 1.1 }}>
              {data.docTitle}
            </div>
            <div style={{ fontSize: '6.5pt', color: '#5a3000', fontWeight: 700, marginTop: '0.5mm' }}>
              ORIGINAL / BUYER COPY
            </div>
          </div>
        </div>
      </div>

      {/* ── CUSTOMER + META ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', border: `0.5px solid ${BORDER}`, borderTop: 'none' }}>
        {/* Bill To */}
        <div style={{ background: NAVY, borderRight: `0.5px solid ${BORDER}` }}>
          <PartyCard title="Billed To (Customer)" party={billTo} />
        </div>

        {/* Delivery To */}
        <div style={{ background: `${NAVY}dd`, borderRight: `0.5px solid ${BORDER}` }}>
          <PartyCard title="Delivery Address" party={delivery} />
        </div>

        {/* Invoice meta */}
        <div style={{ padding: '2mm', background: '#f8fbff' }}>
          <MetaItem label="Invoice No." value={meta.invoiceNo} />
          <MetaItem label="Invoice Date" value={meta.date} />
          <MetaItem label="Due Date" value={meta.dueDate} />
          <MetaItem label="Challan No." value={meta.challanNo} />
          <MetaItem label="Order No." value={meta.orderNo} />
          <MetaItem label="Place of Supply" value={meta.placeOfSupplyLabel} />
        </div>
      </div>

      {/* ── TRANSPORT / AGENT ── */}
      <div style={{ border: `0.5px solid #c0d0e8`, borderTop: 'none', padding: '1.5mm 2mm', background: BG_LIGHT }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '1mm', fontSize: '7.5pt' }}>
          {meta.broker && <div><Lbl>Agent/Broker</Lbl><br /><Val bold>{meta.broker}</Val></div>}
          {meta.transport && <div><Lbl>Transport</Lbl><br /><Val>{meta.transport}</Val></div>}
          {meta.station && <div><Lbl>Station</Lbl><br /><Val>{meta.station}</Val></div>}
          {meta.lrNo && <div><Lbl>L.R. No.</Lbl><br /><Val>{meta.lrNo}</Val></div>}
          {meta.lrDate && <div><Lbl>L.R. Date</Lbl><br /><Val>{meta.lrDate}</Val></div>}
          {meta.baleNo && <div><Lbl>Bale/Case No.</Lbl><br /><Val>{meta.baleNo}</Val></div>}
        </div>
      </div>

      {/* ── ITEM TABLE ── */}
      <div style={{ marginTop: '0' }}>
        <table className="sb-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>S.No.</th>
              <th style={{ width: '22%', textAlign: 'left' }}>Description of Goods</th>
              <th style={{ width: '6%' }}>HSN</th>
              <th style={{ width: '5%' }}>Lot</th>
              <th style={{ width: '5%' }}>Cut</th>
              <th style={{ width: '6%' }}>PCS</th>
              <th style={{ width: '8%' }}>Mtrs</th>
              <th style={{ width: '5%' }}>Unit</th>
              <th style={{ width: '8%' }}>Rate</th>
              <th style={{ width: '6%' }}>Dis%</th>
              <th style={{ width: '10%' }}>Taxable (Rs.)</th>
              <th style={{ width: '7%' }}>GST%</th>
              <th style={{ width: '7%' }}>Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {(lines || []).map((line) => (
              <tr key={line.sno}>
                <td className="sb-center">{line.sno}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{line.name}</div>
                  {line.colour && <div style={{ fontSize: '6.5pt', color: MUTED }}>Colour: {line.colour}</div>}
                  {line.designNo && <div style={{ fontSize: '6.5pt', color: MUTED }}>Design: {line.designNo}</div>}
                  {line.quality && <div style={{ fontSize: '6.5pt', color: MUTED }}>Quality: {line.quality}</div>}
                </td>
                <td className="sb-center">{line.hsn}</td>
                <td className="sb-center">{line.lot || '—'}</td>
                <td className="sb-center">{line.cut || '—'}</td>
                <td className="sb-num">{line.pcs || ''}</td>
                <td className="sb-num">{line.mts ? fmt.num(line.mts) : ''}</td>
                <td className="sb-center">{line.unit}</td>
                <td className="sb-num">{money(line.rate)}</td>
                <td className="sb-center">{line.dis1Per ? `${line.dis1Per}%` : (line.discount ? `${line.discount}` : '—')}</td>
                <td className="sb-num">{money(line.taxable)}</td>
                <td className="sb-center">{line.gstPer ? `${line.gstPer}%` : '—'}</td>
                <td className="sb-num" style={{ fontWeight: 700 }}>{money(line.total)}</td>
              </tr>
            ))}
            {/* Empty rows */}
            {Array.from({ length: Math.max(0, 6 - (lines || []).length) }).map((_, i) => (
              <tr key={`e-${i}`}>
                {Array.from({ length: 13 }).map((__, j) => (
                  <td key={j} style={{ height: '7mm' }}>&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ fontWeight: 700, textAlign: 'center', background: NAVY, color: '#fff' }}>TOTAL</td>
              <td className="sb-num">{totalPcs || ''}</td>
              <td className="sb-num">{totalMts ? fmt.num(totalMts) : ''}</td>
              <td colSpan={3}>&nbsp;</td>
              <td className="sb-num">{money(totals.taxable)}</td>
              <td>&nbsp;</td>
              <td className="sb-num" style={{ fontSize: '9pt', color: NAVY }}>{money(totals.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── BANK + GST SUMMARY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: `0.5px solid #c0d0e8`, borderTop: 'none' }}>
        {/* Bank Details */}
        <div style={{ padding: '2mm 3mm', borderRight: `0.5px solid #c0d0e8` }}>
          <div style={{ fontSize: '7pt', fontWeight: 800, color: NAVY, textTransform: 'uppercase', borderBottom: `1px solid ${NAVY}`, paddingBottom: '0.8mm', marginBottom: '1.5mm' }}>
            Bank & Payment Details
          </div>
          {bank?.bankName ? (
            <table style={{ fontSize: '7.5pt', width: '100%' }}>
              <tbody>
                {[
                  ['Bank Name', `${bank.bankName}${bank.branch ? ` — ${bank.branch}` : ''}`],
                  ['A/c No.', bank.accountNo],
                  ['IFSC Code', bank.ifsc],
                  ['A/c Name', bank.accountName],
                  bank.upiId ? ['UPI / VPA', bank.upiId] : null,
                ].filter(Boolean).map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ width: '35%', color: MUTED, paddingRight: '2mm', paddingBottom: '0.5mm' }}>{l}:</td>
                    <td style={{ fontWeight: 600, color: TEXT }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: '7.5pt', color: MUTED }}>Bank details available on request</div>
          )}
        </div>

        {/* GST Summary */}
        <div style={{ padding: '2mm 3mm' }}>
          <div style={{ fontSize: '7pt', fontWeight: 800, color: NAVY, textTransform: 'uppercase', borderBottom: `1px solid ${NAVY}`, paddingBottom: '0.8mm', marginBottom: '1.5mm' }}>
            GST / Tax Summary
          </div>
          <table className="sb-table" style={{ fontSize: '7pt' }}>
            <thead>
              <tr>
                <th>Tax%</th>
                <th>Taxable Value</th>
                {isIgst ? <th>IGST Amt</th> : <><th>CGST%</th><th>CGST Amt</th><th>SGST%</th><th>SGST Amt</th></>}
                <th>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {(taxRows || []).map((row) => (
                <tr key={row.taxPct}>
                  <td className="sb-center">{row.taxPct}%</td>
                  <td className="sb-num">{money(row.taxValue)}</td>
                  {isIgst ? (
                    <td className="sb-num">{money(row.igstAmt)}</td>
                  ) : (
                    <>
                      <td className="sb-center">{row.cgstPct}%</td>
                      <td className="sb-num">{money(row.cgstAmt)}</td>
                      <td className="sb-center">{row.sgstPct}%</td>
                      <td className="sb-num">{money(row.sgstAmt)}</td>
                    </>
                  )}
                  <td className="sb-num" style={{ fontWeight: 700 }}>{money(row.cgstAmt + row.sgstAmt + row.igstAmt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ marginTop: '2mm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1mm', fontSize: '7.5pt' }}>
            {[
              ['Taxable Amount', totals.taxable, false],
              ['GST Amount', totals.gst, false],
              totals.roundOff ? ['Round Off', totals.roundOff, false] : null,
              ['Net Payable', totals.grandTotal, true],
            ].filter(Boolean).map(([l, v, bold]) => (
              <React.Fragment key={l}>
                <div style={{ color: MUTED, textAlign: 'right', paddingRight: '1mm', borderTop: bold ? `1.5px solid ${NAVY}` : '0.3px solid #ccc', paddingTop: '0.5mm' }}>{l}</div>
                <div style={{ fontWeight: bold ? 800 : 500, textAlign: 'right', color: bold ? NAVY : TEXT, fontSize: bold ? '9pt' : '7.5pt', borderTop: bold ? `1.5px solid ${NAVY}` : '0.3px solid #ccc', paddingTop: '0.5mm' }}>
                  {money(v)}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── AMOUNT IN WORDS + NET ── */}
      <div style={{ border: `0.5px solid #c0d0e8`, borderTop: 'none', padding: '1.5mm 3mm', background: '#e8f0ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '7.5pt', color: TEXT }}>
          <strong style={{ color: MUTED }}>Rupees (in words):</strong>&nbsp;
          <em style={{ fontWeight: 600 }}>{totals.amountWords}</em>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '6.5pt', color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>Grand Total</div>
          <div style={{ fontWeight: 900, fontSize: '13pt', color: NAVY, lineHeight: 1 }}>₹ {money(totals.grandTotal)}</div>
        </div>
      </div>

      {/* ── TERMS + SIGNATURE ── */}
      <div style={{ border: `0.5px solid #c0d0e8`, borderTop: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '2mm 3mm', borderRight: `0.5px solid #c0d0e8` }}>
          <div style={{ fontSize: '7pt', fontWeight: 800, color: NAVY, textTransform: 'uppercase', marginBottom: '1mm' }}>Terms & Conditions</div>
          <ol style={{ margin: 0, paddingLeft: '4mm', fontSize: '7pt', color: MUTED, lineHeight: 1.55 }}>
            {(termsList || []).map((t) => <li key={t} style={{ marginBottom: '0.5mm' }}>{t}</li>)}
          </ol>
          <div style={{ marginTop: '2mm', fontSize: '6.5pt', color: MUTED, fontStyle: 'italic' }}>
            We declare that this invoice shows the actual price of goods described and all particulars are true and correct.
          </div>
        </div>
        <div style={{ padding: '3mm', textAlign: 'right' }}>
          <div style={{ fontSize: '7pt', color: MUTED }}>E. &amp; O.E.</div>
          <div style={{ fontWeight: 700, fontSize: '8.5pt', color: TEXT, marginTop: '1mm' }}>For {company?.name}</div>
          <div style={{ marginTop: '14mm', borderTop: `1px dashed ${NAVY}`, paddingTop: '1.5mm', display: 'inline-block', fontSize: '7.5pt', color: MUTED, fontWeight: 600 }}>
            Authorised Signatory
          </div>
          <div style={{ marginTop: '3mm', fontSize: '6.5pt', color: MUTED }}>
            Receiver's Signature &amp; Date: _______________
          </div>
        </div>
      </div>
    </InvoicePrintRoot>
  );
}
