/**
 * Royal Gold — Luxury Gold Letterhead Invoice
 * Warm Cream Paper · Gold Rule Lines · Elegant Typography
 * Full GST Compliance · Professional Accounting Layout
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { addressLines, buildTotalsRows } from '../engine/utils';

const DARK = '#1a0e00';
const GOLD_DARK = '#7a5c10';
const GOLD = '#b8921a';
const GOLD_LIGHT = '#d4a828';
const GOLD_PALE = '#f9f0d8';
const CREAM = '#fffdf5';
const BROWN = '#4a3010';
const MUTED = '#6b5030';
const RULE = '#c8a830';

const money = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function GoldRule({ thick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8mm', margin: '2mm 0' }}>
      <div style={{ height: thick ? '1.5px' : '0.5px', background: GOLD }} />
      {thick && <div style={{ height: '0.5px', background: GOLD_LIGHT }} />}
    </div>
  );
}

function RgParty({ title, party, align = 'left' }) {
  const lines = addressLines(party);
  return (
    <div style={{ padding: '2.5mm 3mm', border: `0.5px solid ${GOLD}`, background: CREAM, textAlign: align }}>
      <div style={{ fontSize: '6.5pt', fontWeight: 700, color: GOLD_DARK, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.5mm' }}>
        {title}
      </div>
      <div style={{ fontWeight: 800, fontSize: '10pt', color: DARK, lineHeight: 1.2, marginBottom: '1mm' }}>
        {party?.name || '—'}
      </div>
      {lines.map((l) => (
        <div key={l} style={{ fontSize: '7.5pt', color: BROWN, lineHeight: 1.45 }}>{l}</div>
      ))}
      <div style={{ marginTop: '1.5mm', fontSize: '7pt', lineHeight: 1.55 }}>
        {party?.gstin && <div style={{ color: GOLD_DARK }}><strong>GSTIN:</strong> <span style={{ fontFamily: 'monospace', color: DARK }}>{party.gstin}</span></div>}
        {party?.stateLabel && <div style={{ color: BROWN }}><strong>State:</strong> {party.stateLabel}</div>}
        {party?.pan && <div style={{ color: BROWN }}><strong>PAN:</strong> {party.pan}</div>}
        {party?.phone && <div style={{ color: BROWN }}><strong>Mobile:</strong> {party.phone}</div>}
      </div>
    </div>
  );
}

export default function RoyalGold({ data }) {
  const { company, meta, billTo, shipTo, lines, totals, fmt, bank, termsList, taxRows, isIgst } = data;
  const delivery = shipTo?.name !== billTo?.name ? shipTo : billTo;
  const totalPcs = (lines || []).reduce((s, l) => s + (Number(l.pcs) || 0), 0);
  const totalMts = (lines || []).reduce((s, l) => s + (Number(l.mts) || 0), 0);

  return (
    <InvoicePrintRoot templateId="royal-gold" data={data} showFooter={false}>
      <style>{`
        .rg-doc { background: ${CREAM}; font-family: 'Georgia', 'Times New Roman', serif; color: ${DARK}; }
        .rg-tbl { width: 100%; border-collapse: collapse; }
        .rg-tbl th { background: ${GOLD_PALE}; color: ${GOLD_DARK}; font-size: 7pt; font-weight: 700; padding: 1.5mm 1.5mm; border: 0.5px solid ${RULE}; text-align: center; font-family: 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: 0.04em; }
        .rg-tbl td { font-size: 7.5pt; padding: 1.2mm 1.5mm; border: 0.5px solid #ddc88a; vertical-align: middle; }
        .rg-tbl tbody tr:nth-child(even) td { background: #fdf9ee; }
        .rg-tbl tfoot td { font-weight: 700; background: ${GOLD_PALE}; border: 0.5px solid ${RULE}; font-size: 8pt; }
        .rg-num { text-align: right; }
        .rg-ctr { text-align: center; }
      `}</style>

      <div className="rg-doc">
        {/* ── TOP GOLD RULE ── */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT}, ${GOLD_DARK})` }} />

        {/* ── LETTERHEAD ── */}
        <div style={{ textAlign: 'center', padding: '4mm 5mm 2mm', borderBottom: `0.5px solid ${RULE}` }}>
          <div style={{ fontSize: '8pt', letterSpacing: '0.3em', color: GOLD, fontFamily: 'Georgia, serif', marginBottom: '1mm' }}>
            ✦ श्री गणेशाय नमः ✦
          </div>
          <div style={{ fontWeight: 900, fontSize: '18pt', color: DARK, letterSpacing: '0.05em', fontFamily: 'Georgia, serif', lineHeight: 1.1 }}>
            {company?.name}
          </div>
          {company?.tagline && (
            <div style={{ fontSize: '8pt', color: MUTED, marginTop: '0.5mm', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {company.tagline}
            </div>
          )}
          <div style={{ fontSize: '7.5pt', color: BROWN, marginTop: '1.5mm', lineHeight: 1.5 }}>
            {[company?.addressFull || company?.address, company?.area].filter(Boolean).join(', ')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8mm', marginTop: '1.5mm', flexWrap: 'wrap' }}>
            {company?.phone && <span style={{ fontSize: '7pt', color: BROWN }}>📞 {company.phone}</span>}
            {company?.email && <span style={{ fontSize: '7pt', color: BROWN }}>✉ {company.email}</span>}
            {company?.gstin && <span style={{ fontSize: '7.5pt', color: GOLD_DARK, fontWeight: 700, fontFamily: 'monospace' }}>GSTIN: {company.gstin}</span>}
          </div>
        </div>

        <GoldRule thick />

        {/* ── INVOICE TITLE & META ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', margin: '1mm 0 2mm', padding: '0 2mm' }}>
          <div style={{ fontSize: '7.5pt', color: MUTED }}>
            <div><strong>Reverse Charge:</strong> {meta.reverseCharge || 'N'}</div>
            <div><strong>Place of Supply:</strong> {meta.placeOfSupplyLabel || '—'}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1.5mm 8mm', border: `1.5px solid ${GOLD}` }}>
            <div style={{ fontSize: '13pt', fontWeight: 900, color: GOLD_DARK, letterSpacing: '0.1em', fontFamily: 'Georgia, serif' }}>
              {data.docTitle}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '7.5pt', color: MUTED }}>
            <div><strong style={{ color: GOLD_DARK }}>Invoice No:</strong> {meta.invoiceNo}</div>
            <div><strong style={{ color: GOLD_DARK }}>Date:</strong> {meta.date}</div>
            {meta.dueDate && <div><strong>Due Date:</strong> {meta.dueDate}</div>}
          </div>
        </div>

        <GoldRule />

        {/* ── PARTY ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', margin: '2mm 0' }}>
          <RgParty title="Billed To (Customer)" party={billTo} />
          <RgParty title="Delivery / Ship To" party={delivery} align="right" />
        </div>

        {/* ── TRANSPORT ── */}
        {(meta.transport || meta.broker || meta.lrNo) && (
          <div style={{ border: `0.5px solid ${RULE}`, background: '#fdf8ec', padding: '1.5mm 3mm', marginBottom: '2mm' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2mm', fontSize: '7.5pt' }}>
              {[
                ['Agent', meta.broker],
                ['Transport', meta.transport],
                ['Station', meta.station],
                ['L.R. No.', meta.lrNo],
                ['L.R. Date', meta.lrDate],
                ['Bale / Case', meta.baleNo],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: '6.5pt', color: GOLD_DARK, fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontWeight: 600, color: DARK }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ITEM TABLE ── */}
        <table className="rg-tbl">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>S.No</th>
              <th style={{ width: '24%', textAlign: 'left' }}>Description</th>
              <th style={{ width: '7%' }}>HSN</th>
              <th style={{ width: '5%' }}>Lot</th>
              <th style={{ width: '4%' }}>Cut</th>
              <th style={{ width: '5%' }}>PCS</th>
              <th style={{ width: '7%' }}>Mtrs</th>
              <th style={{ width: '8%' }}>Rate</th>
              <th style={{ width: '5%' }}>Dis%</th>
              <th style={{ width: '11%' }}>Taxable</th>
              <th style={{ width: '5%' }}>GST%</th>
              <th style={{ width: '11%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(lines || []).map((line) => (
              <tr key={line.sno}>
                <td className="rg-ctr">{line.sno}</td>
                <td>
                  <span style={{ fontWeight: 700 }}>{line.name}</span>
                  {line.colour && <span style={{ fontSize: '6.5pt', color: MUTED }}> · {line.colour}</span>}
                  {line.designNo && <span style={{ fontSize: '6.5pt', color: MUTED }}> · {line.designNo}</span>}
                </td>
                <td className="rg-ctr">{line.hsn}</td>
                <td className="rg-ctr">{line.lot || '—'}</td>
                <td className="rg-ctr">{line.cut || '—'}</td>
                <td className="rg-num">{line.pcs || ''}</td>
                <td className="rg-num">{line.mts ? fmt.num(line.mts) : ''}</td>
                <td className="rg-num">{money(line.rate)}</td>
                <td className="rg-ctr">{line.dis1Per ? `${line.dis1Per}%` : '—'}</td>
                <td className="rg-num">{money(line.taxable)}</td>
                <td className="rg-ctr">{line.gstPer ? `${line.gstPer}%` : '—'}</td>
                <td className="rg-num" style={{ fontWeight: 700 }}>{money(line.total)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 5 - (lines || []).length) }).map((_, i) => (
              <tr key={`e${i}`}>
                {Array.from({ length: 12 }).map((__, j) => <td key={j} style={{ height: '7mm' }}>&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: GOLD_DARK, fontWeight: 800, fontStyle: 'italic' }}>Total</td>
              <td />
              <td className="rg-num">{totalPcs || ''}</td>
              <td className="rg-num">{totalMts ? fmt.num(totalMts) : ''}</td>
              <td colSpan={2}>&nbsp;</td>
              <td className="rg-num" style={{ color: GOLD_DARK }}>{money(totals.taxable)}</td>
              <td>&nbsp;</td>
              <td className="rg-num" style={{ color: GOLD_DARK, fontSize: '9pt' }}>{money(totals.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <GoldRule />

        {/* ── BANK + TAX + TOTALS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', margin: '2mm 0' }}>
          {/* Bank */}
          <div style={{ border: `0.5px solid ${RULE}`, padding: '2mm 3mm', background: '#fdf8ec' }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, color: GOLD_DARK, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5mm', borderBottom: `0.5px solid ${RULE}`, paddingBottom: '0.8mm' }}>
              Bank &amp; Payment Details
            </div>
            {bank?.bankName ? (
              <table style={{ width: '100%', fontSize: '7.5pt' }}>
                <tbody>
                  {[
                    ['Bank', `${bank.bankName}${bank.branch ? ` · ${bank.branch}` : ''}`],
                    ['Account No.', bank.accountNo],
                    ['IFSC', bank.ifsc],
                    bank.upiId ? ['UPI ID', bank.upiId] : null,
                  ].filter(Boolean).map(([l, v]) => (
                    <tr key={l}>
                      <td style={{ color: MUTED, paddingRight: '2mm', paddingBottom: '0.5mm', width: '30%' }}>{l}:</td>
                      <td style={{ fontWeight: 600, color: DARK }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ fontSize: '7.5pt', color: MUTED }}>Contact for payment details</div>
            )}

            {/* Terms */}
            <div style={{ marginTop: '2mm', fontSize: '7pt', color: MUTED, borderTop: `0.3px solid ${RULE}`, paddingTop: '1mm' }}>
              <strong style={{ color: GOLD_DARK, display: 'block', marginBottom: '0.5mm' }}>Terms &amp; Conditions</strong>
              <ol style={{ margin: 0, paddingLeft: '3.5mm', lineHeight: 1.55 }}>
                {(termsList || []).map((t) => <li key={t} style={{ marginBottom: '0.3mm' }}>{t}</li>)}
              </ol>
            </div>
          </div>

          {/* Tax + Totals */}
          <div>
            {/* GST Table */}
            <table className="rg-tbl" style={{ fontSize: '7pt', marginBottom: '2mm' }}>
              <thead>
                <tr>
                  <th>Tax %</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  {isIgst ? <th style={{ textAlign: 'right' }}>IGST</th> : <><th>CGST%</th><th style={{ textAlign: 'right' }}>CGST</th><th>SGST%</th><th style={{ textAlign: 'right' }}>SGST</th></>}
                  <th style={{ textAlign: 'right' }}>Tax Total</th>
                </tr>
              </thead>
              <tbody>
                {(taxRows || []).map((row) => (
                  <tr key={row.taxPct}>
                    <td className="rg-ctr">{row.taxPct}%</td>
                    <td className="rg-num">{money(row.taxValue)}</td>
                    {isIgst ? (
                      <td className="rg-num">{money(row.igstAmt)}</td>
                    ) : (
                      <>
                        <td className="rg-ctr">{row.cgstPct}%</td>
                        <td className="rg-num">{money(row.cgstAmt)}</td>
                        <td className="rg-ctr">{row.sgstPct}%</td>
                        <td className="rg-num">{money(row.sgstAmt)}</td>
                      </>
                    )}
                    <td className="rg-num" style={{ fontWeight: 700 }}>{money(row.cgstAmt + row.sgstAmt + row.igstAmt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals rows */}
            <div style={{ border: `0.5px solid ${RULE}`, padding: '1.5mm 2mm', background: '#fdf8ec' }}>
              {buildTotalsRows(data).map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5mm 0', borderBottom: `0.3px solid ${RULE}` }}>
                  <span style={{ fontSize: '7.5pt', color: row.accent ? GOLD_DARK : MUTED, fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                  <span style={{ fontSize: row.accent ? '9pt' : '7.5pt', fontWeight: row.bold ? 800 : 400, color: row.accent ? GOLD_DARK : DARK, fontFamily: 'monospace' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── AMOUNT IN WORDS + SIGNATURE ── */}
        <GoldRule />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', alignItems: 'end', padding: '1mm 0' }}>
          <div>
            <div style={{ fontSize: '7pt', color: GOLD_DARK, fontWeight: 700, marginBottom: '0.5mm' }}>Amount Chargeable (in words):</div>
            <div style={{ fontSize: '8pt', fontStyle: 'italic', color: DARK, fontFamily: 'Georgia, serif' }}>{totals.amountWords}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '7pt', color: MUTED }}>E. &amp; O.E.</div>
            <div style={{ fontWeight: 700, fontSize: '8.5pt', color: DARK }}>For {company?.name}</div>
            <div style={{ marginTop: '13mm', borderTop: `1px solid ${GOLD}`, paddingTop: '1.5mm', fontSize: '7.5pt', color: MUTED, fontWeight: 600 }}>
              Authorised Signatory
            </div>
          </div>
        </div>

        {/* ── BOTTOM GOLD RULE ── */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT}, ${GOLD_DARK})`, marginTop: '3mm' }} />
      </div>
    </InvoicePrintRoot>
  );
}
