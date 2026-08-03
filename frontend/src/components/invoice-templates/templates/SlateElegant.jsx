/**
 * Slate Elegant — Contemporary Dark Charcoal Invoice
 * Dark Slate Header · Accent Green Strip · Minimalist White Body
 * Full Business Details · Professional Tax Layout
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { addressLines, buildTotalsRows } from '../engine/utils';

const SLATE = '#1e293b';
const SLATE_MED = '#334155';
const SLATE_LIGHT = '#475569';
const ACCENT = '#10b981';
const ACCENT_LIGHT = '#d1fae5';
const SILVER = '#f1f5f9';
const BORDER = '#cbd5e1';
const TEXT = '#0f172a';
const MUTED = '#64748b';
const WHITE = '#ffffff';

const money = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function SeParty({ title, party }) {
  const lines = addressLines(party);
  return (
    <div style={{ border: `1px solid ${BORDER}`, background: WHITE }}>
      <div style={{ background: SLATE_MED, color: WHITE, fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '1.2mm 3mm' }}>
        {title}
      </div>
      <div style={{ padding: '2mm 3mm' }}>
        <div style={{ fontWeight: 800, fontSize: '9.5pt', color: TEXT, lineHeight: 1.2, marginBottom: '1mm' }}>
          {party?.name || '—'}
        </div>
        {lines.map((l) => (
          <div key={l} style={{ fontSize: '7.5pt', color: MUTED, lineHeight: 1.4 }}>{l}</div>
        ))}
        <div style={{ marginTop: '1.5mm', fontSize: '7pt', lineHeight: 1.6 }}>
          {party?.gstin && <div><strong style={{ color: SLATE_MED }}>GSTIN:</strong> <code style={{ fontSize: '7pt', background: SILVER, padding: '0.1mm 1mm' }}>{party.gstin}</code></div>}
          {party?.stateLabel && <div style={{ color: MUTED }}><strong>State:</strong> {party.stateLabel}</div>}
          {party?.phone && <div style={{ color: MUTED }}><strong>Ph:</strong> {party.phone}</div>}
        </div>
      </div>
    </div>
  );
}

export default function SlateElegant({ data }) {
  const { company, meta, billTo, shipTo, lines, totals, fmt, bank, termsList, taxRows, isIgst } = data;
  const delivery = shipTo?.name !== billTo?.name ? shipTo : billTo;
  const totalPcs = (lines || []).reduce((s, l) => s + (Number(l.pcs) || 0), 0);
  const totalMts = (lines || []).reduce((s, l) => s + (Number(l.mts) || 0), 0);

  return (
    <InvoicePrintRoot templateId="slate-elegant" data={data} showFooter={false}>
      <style>{`
        .se-tbl { width: 100%; border-collapse: collapse; }
        .se-tbl th { background: ${SLATE}; color: #fff; font-size: 6.5pt; font-weight: 600; padding: 1.5mm 1.5mm; text-align: center; border: 0.5px solid ${SLATE_MED}; text-transform: uppercase; letter-spacing: 0.05em; }
        .se-tbl td { font-size: 7.5pt; padding: 1.2mm 1.5mm; border: 0.5px solid ${BORDER}; color: ${TEXT}; vertical-align: middle; }
        .se-tbl tbody tr:nth-child(even) td { background: ${SILVER}; }
        .se-tbl tfoot td { font-weight: 700; background: ${SLATE}; color: #fff; border: 0.5px solid ${SLATE_MED}; font-size: 8pt; }
        .se-num { text-align: right; font-variant-numeric: tabular-nums; }
        .se-ctr { text-align: center; }
        .se-badge { display: inline-block; background: ${ACCENT_LIGHT}; color: ${ACCENT}; font-size: 6pt; font-weight: 700; padding: 0.2mm 1.5mm; border: 0.5px solid ${ACCENT}; letter-spacing: 0.03em; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: SLATE, padding: '4mm 5mm 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', alignItems: 'start' }}>
          {/* Company */}
          <div>
            <div style={{ fontWeight: 900, fontSize: '16pt', color: WHITE, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {company?.name}
            </div>
            <div style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: '1mm', lineHeight: 1.5 }}>
              {[company?.addressFull || company?.address, company?.area].filter(Boolean).join(' ')}
            </div>
            <div style={{ display: 'flex', gap: '5mm', marginTop: '1.5mm', flexWrap: 'wrap' }}>
              {company?.phone && <span style={{ fontSize: '7pt', color: '#cbd5e1' }}>📞 {company.phone}</span>}
              {company?.email && <span style={{ fontSize: '7pt', color: '#94a3b8' }}>{company.email}</span>}
            </div>
            {company?.gstin && (
              <div style={{ marginTop: '1.5mm', fontSize: '7pt', color: ACCENT, fontWeight: 700, fontFamily: 'monospace' }}>
                GSTIN: {company.gstin}
              </div>
            )}
          </div>

          {/* Invoice meta box */}
          <div style={{ textAlign: 'right', paddingTop: '1mm' }}>
            <div style={{ background: ACCENT, color: WHITE, padding: '1mm 3mm', display: 'inline-block', fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2mm' }}>
              {data.docTitle}
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 900, color: WHITE }}>{meta.invoiceNo}</div>
            <div style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: '0.5mm' }}>Date: {meta.date}</div>
            {meta.dueDate && <div style={{ fontSize: '7pt', color: '#fbbf24' }}>Due: {meta.dueDate}</div>}
          </div>
        </div>

        {/* Green accent strip */}
        <div style={{ height: '3px', background: ACCENT, marginTop: '3mm' }} />
      </div>

      {/* ── SUPPLY INFO STRIP ── */}
      <div style={{ background: SILVER, borderBottom: `1px solid ${BORDER}`, padding: '1.2mm 4mm', display: 'flex', gap: '8mm', fontSize: '7.5pt' }}>
        <span style={{ color: MUTED }}>Place of Supply: <strong style={{ color: TEXT }}>{meta.placeOfSupplyLabel || '—'}</strong></span>
        <span style={{ color: MUTED }}>Reverse Charge: <strong style={{ color: TEXT }}>{meta.reverseCharge || 'N'}</strong></span>
        {meta.challanNo && <span style={{ color: MUTED }}>Challan: <strong style={{ color: TEXT }}>{meta.challanNo}</strong></span>}
        {meta.orderNo && <span style={{ color: MUTED }}>Order: <strong style={{ color: TEXT }}>{meta.orderNo}</strong></span>}
      </div>

      {/* ── PARTY ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', margin: '3mm 0 2mm' }}>
        <SeParty title="Bill To (Customer)" party={billTo} />
        <SeParty title="Delivery / Ship To" party={delivery} />
      </div>

      {/* ── TRANSPORT ROW ── */}
      {(meta.transport || meta.broker || meta.lrNo) && (
        <div style={{ border: `1px solid ${BORDER}`, background: SILVER, padding: '1.5mm 3mm', marginBottom: '2mm' }}>
          <div style={{ fontSize: '6.5pt', fontWeight: 700, color: SLATE_MED, textTransform: 'uppercase', marginBottom: '1mm' }}>Transport &amp; Dispatch Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2mm', fontSize: '7.5pt' }}>
            {[
              ['Broker / Agent', meta.broker],
              ['Transport', meta.transport],
              ['Station', meta.station],
              ['L.R. No.', meta.lrNo],
              ['L.R. Date', meta.lrDate],
              ['Bale / Case No.', meta.baleNo],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: '6pt', color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
                <div style={{ fontWeight: 700, color: SLATE, marginTop: '0.3mm' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ITEM TABLE ── */}
      <table className="se-tbl">
        <thead>
          <tr>
            <th style={{ width: '4%' }}>Sr.</th>
            <th style={{ width: '27%', textAlign: 'left' }}>Description of Goods</th>
            <th style={{ width: '6%' }}>HSN</th>
            <th style={{ width: '4%' }}>Cut</th>
            <th style={{ width: '5%' }}>PCS</th>
            <th style={{ width: '7%' }}>Mtrs</th>
            <th style={{ width: '5%' }}>Unit</th>
            <th style={{ width: '8%' }}>Rate</th>
            <th style={{ width: '5%' }}>Dis%</th>
            <th style={{ width: '10%' }}>Taxable</th>
            <th style={{ width: '5%' }}>GST%</th>
            <th style={{ width: '10%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(lines || []).map((line) => (
            <tr key={line.sno}>
              <td className="se-ctr" style={{ color: SLATE_LIGHT, fontWeight: 600 }}>{line.sno}</td>
              <td>
                <div style={{ fontWeight: 700, color: TEXT }}>{line.name}</div>
                <div style={{ fontSize: '6.5pt', color: MUTED, marginTop: '0.3mm' }}>
                  {[line.colour && `Col: ${line.colour}`, line.designNo && `Des: ${line.designNo}`, line.quality && `Qual: ${line.quality}`].filter(Boolean).join(' · ')}
                </div>
              </td>
              <td className="se-ctr">
                {line.hsn ? <span className="se-badge">{line.hsn}</span> : '—'}
              </td>
              <td className="se-ctr">{line.cut || '—'}</td>
              <td className="se-num">{line.pcs || ''}</td>
              <td className="se-num">{line.mts ? fmt.num(line.mts) : ''}</td>
              <td className="se-ctr">{line.unit}</td>
              <td className="se-num">{money(line.rate)}</td>
              <td className="se-ctr">{line.dis1Per ? `${line.dis1Per}%` : '—'}</td>
              <td className="se-num">{money(line.taxable)}</td>
              <td className="se-ctr">{line.gstPer ? `${line.gstPer}%` : '—'}</td>
              <td className="se-num" style={{ fontWeight: 700, color: SLATE }}>{money(line.total)}</td>
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
            <td colSpan={4} className="se-ctr" style={{ background: SLATE_MED }}>TOTAL</td>
            <td className="se-num">{totalPcs || ''}</td>
            <td className="se-num">{totalMts ? fmt.num(totalMts) : ''}</td>
            <td colSpan={3}>&nbsp;</td>
            <td className="se-num">{money(totals.taxable)}</td>
            <td>&nbsp;</td>
            <td className="se-num" style={{ color: ACCENT, fontSize: '9.5pt' }}>₹ {money(totals.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── BANK + GST + TOTALS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginTop: '3mm' }}>
        {/* Bank Details */}
        <div style={{ border: `1px solid ${BORDER}`, background: WHITE }}>
          <div style={{ background: SLATE_MED, color: WHITE, fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '1.2mm 3mm' }}>
            Bank &amp; Payment Details
          </div>
          <div style={{ padding: '2mm 3mm' }}>
            {bank?.bankName ? (
              <table style={{ width: '100%', fontSize: '7.5pt', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Bank', `${bank.bankName}${bank.branch ? ` — ${bank.branch}` : ''}`],
                    ['Account No.', bank.accountNo],
                    ['IFSC', bank.ifsc],
                    bank.upiId ? ['UPI / VPA', bank.upiId] : null,
                  ].filter(Boolean).map(([l, v]) => (
                    <tr key={l}>
                      <td style={{ width: '32%', color: MUTED, paddingBottom: '0.8mm', fontWeight: 600, fontSize: '7pt', textTransform: 'uppercase' }}>{l}</td>
                      <td style={{ fontWeight: 700, color: TEXT, fontFamily: l === 'Account No.' || l === 'IFSC' ? 'monospace' : 'inherit', fontSize: l === 'IFSC' ? '7.5pt' : '7.5pt' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ fontSize: '7.5pt', color: MUTED }}>Bank details available on request</div>
            )}
          </div>

          {/* Terms */}
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: '1.5mm 3mm', background: SILVER, fontSize: '7pt', color: MUTED, lineHeight: 1.55 }}>
            <strong style={{ color: SLATE, display: 'block', marginBottom: '0.5mm', fontSize: '7pt' }}>Terms &amp; Conditions</strong>
            <ol style={{ margin: 0, paddingLeft: '3.5mm' }}>
              {(termsList || []).map((t) => <li key={t} style={{ marginBottom: '0.3mm' }}>{t}</li>)}
            </ol>
            <div style={{ marginTop: '1mm', fontStyle: 'italic', fontSize: '6.5pt' }}>
              We declare that this invoice shows the actual price of goods described and all particulars are true and correct.
            </div>
          </div>
        </div>

        {/* GST + Totals */}
        <div>
          {/* GST Summary */}
          <div style={{ border: `1px solid ${BORDER}`, marginBottom: '2mm' }}>
            <div style={{ background: SLATE_MED, color: WHITE, fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '1.2mm 3mm' }}>
              GST / Tax Summary
            </div>
            <table className="se-tbl" style={{ fontSize: '7pt' }}>
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
                    <td className="se-ctr">{row.taxPct}%</td>
                    <td className="se-num">{money(row.taxValue)}</td>
                    {isIgst ? (
                      <td className="se-num">{money(row.igstAmt)}</td>
                    ) : (
                      <>
                        <td className="se-ctr">{row.cgstPct}%</td>
                        <td className="se-num">{money(row.cgstAmt)}</td>
                        <td className="se-ctr">{row.sgstPct}%</td>
                        <td className="se-num">{money(row.sgstAmt)}</td>
                      </>
                    )}
                    <td className="se-num" style={{ fontWeight: 700, color: ACCENT }}>{money(row.cgstAmt + row.sgstAmt + row.igstAmt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div style={{ border: `1px solid ${BORDER}` }}>
            {buildTotalsRows(data).map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '1mm 3mm',
                background: row.accent ? SLATE : WHITE,
                borderBottom: `0.3px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: '7.5pt', color: row.accent ? '#fff' : MUTED, fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                <span style={{ fontSize: row.accent ? '10.5pt' : '7.5pt', fontWeight: row.bold ? 800 : 400, color: row.accent ? ACCENT : TEXT, fontFamily: 'monospace' }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AMOUNT IN WORDS + SIGNATURE ── */}
      <div style={{ marginTop: '3mm', display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', alignItems: 'end' }}>
        <div style={{ border: `1px solid ${BORDER}`, padding: '1.5mm 3mm', background: SILVER }}>
          <span style={{ fontSize: '7pt', color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount in Words: </span>
          <br />
          <span style={{ fontSize: '8.5pt', fontStyle: 'italic', color: TEXT, fontWeight: 600 }}>{totals.amountWords}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7pt', color: MUTED }}>E. &amp; O.E.</div>
          <div style={{ fontWeight: 700, color: TEXT }}>For {company?.name}</div>
          <div style={{ marginTop: '13mm', borderTop: `2px solid ${ACCENT}`, paddingTop: '1.5mm', display: 'inline-block', fontSize: '7.5pt', color: MUTED }}>
            Authorised Signatory
          </div>
          <div style={{ fontSize: '6.5pt', color: MUTED, marginTop: '2mm' }}>
            Receiver's Signature: _______________
          </div>
        </div>
      </div>

      {/* Accent bottom bar */}
      <div style={{ height: '3px', background: `linear-gradient(90deg, ${SLATE}, ${ACCENT}, ${SLATE})`, marginTop: '4mm' }} />
    </InvoicePrintRoot>
  );
}
