/**
 * Ocean Blue — Corporate Modern Invoice
 * Clean Blue Header · Card-based Party Layout · Modern Sans Serif
 * Complete GST Details · Transport Info · Bank & UPI Payment
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { addressLines, buildTotalsRows } from '../engine/utils';

const BLUE = '#1565c0';
const BLUE_MED = '#1976d2';
const BLUE_LIGHT = '#e3f2fd';
const BLUE_PALE = '#f0f7ff';
const TEAL = '#00838f';
const DARK = '#0d1b2a';
const MUTED = '#455a64';
const BORDER = '#90caf9';
const TEXT = '#1a2530';

const money = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function Tag({ children, color = BLUE }) {
  return (
    <span style={{ fontSize: '6pt', fontWeight: 700, background: color, color: '#fff', padding: '0.3mm 1.5mm', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-block' }}>
      {children}
    </span>
  );
}

function ObParty({ title, party, accent }) {
  const lines = addressLines(party);
  return (
    <div style={{ border: `1px solid ${accent || BLUE}`, background: BLUE_PALE, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ background: accent || BLUE, padding: '1mm 3mm', fontSize: '6.5pt', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div style={{ padding: '2mm 3mm' }}>
        <div style={{ fontWeight: 800, fontSize: '9.5pt', color: DARK, lineHeight: 1.2, marginBottom: '1mm' }}>
          {party?.name || '—'}
        </div>
        {lines.map((l) => (
          <div key={l} style={{ fontSize: '7.5pt', color: MUTED, lineHeight: 1.4 }}>{l}</div>
        ))}
        <div style={{ marginTop: '1.5mm', fontSize: '7pt', lineHeight: 1.6 }}>
          {party?.gstin && <div><strong style={{ color: BLUE }}>GSTIN:</strong> <span style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{party.gstin}</span></div>}
          {party?.stateLabel && <div><strong style={{ color: BLUE }}>State:</strong> {party.stateLabel}</div>}
          {party?.phone && <div><strong style={{ color: BLUE }}>Ph:</strong> {party.phone}</div>}
        </div>
      </div>
    </div>
  );
}

export default function OceanBlue({ data }) {
  const { company, meta, billTo, shipTo, lines, totals, fmt, bank, termsList, taxRows, isIgst } = data;
  const delivery = shipTo?.name !== billTo?.name ? shipTo : billTo;
  const totalPcs = (lines || []).reduce((s, l) => s + (Number(l.pcs) || 0), 0);
  const totalMts = (lines || []).reduce((s, l) => s + (Number(l.mts) || 0), 0);

  return (
    <InvoicePrintRoot templateId="ocean-blue" data={data} showFooter={false}>
      <style>{`
        .ob-tbl { width: 100%; border-collapse: collapse; }
        .ob-tbl th { background: ${BLUE}; color: #fff; font-size: 7pt; font-weight: 600; padding: 1.5mm 1.5mm; text-align: center; border: 0.5px solid ${BLUE_MED}; letter-spacing: 0.03em; }
        .ob-tbl td { font-size: 7.5pt; padding: 1.2mm 1.5mm; border: 0.5px solid ${BORDER}; color: ${TEXT}; vertical-align: middle; }
        .ob-tbl tbody tr:nth-child(even) td { background: ${BLUE_LIGHT}; }
        .ob-tbl tbody tr:hover td { background: #dbeaff; }
        .ob-tbl tfoot td { font-weight: 700; background: ${BLUE_LIGHT}; border: 0.5px solid ${BLUE}; font-size: 8pt; color: ${BLUE}; }
        .ob-num { text-align: right; font-variant-numeric: tabular-nums; }
        .ob-ctr { text-align: center; }
        .ob-pill { display: inline-block; background: ${BLUE_LIGHT}; color: ${BLUE}; font-size: 6pt; font-weight: 700; padding: 0.2mm 1.5mm; border-radius: 20px; border: 0.5px solid ${BORDER}; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #0d47a1 50%, ${TEAL} 100%)`, padding: '4mm 5mm 3.5mm' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', alignItems: 'center' }}>
          {/* Company */}
          <div>
            <div style={{ fontWeight: 900, fontSize: '15pt', color: '#fff', letterSpacing: '-0.01em' }}>
              {company?.name}
            </div>
            <div style={{ fontSize: '7.5pt', color: '#90caf9', marginTop: '0.5mm', lineHeight: 1.5 }}>
              {[company?.addressFull || company?.address, company?.area].filter(Boolean).join(' ')}
            </div>
            <div style={{ display: 'flex', gap: '5mm', marginTop: '1.5mm', flexWrap: 'wrap' }}>
              {company?.phone && <span style={{ fontSize: '7pt', color: '#e3f2fd' }}>📞 {company.phone}</span>}
              {company?.email && <span style={{ fontSize: '7pt', color: '#90caf9' }}>{company.email}</span>}
            </div>
            {company?.gstin && (
              <div style={{ marginTop: '1.5mm', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '0.5mm 2mm', fontSize: '7.5pt', color: '#fff', fontWeight: 700 }}>
                GSTIN: {company.gstin}
              </div>
            )}
          </div>

          {/* Invoice box */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', padding: '2.5mm 4mm' }}>
              <div style={{ fontSize: '7pt', color: '#90caf9', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5mm' }}>
                {data.docTitle}
              </div>
              <div style={{ fontWeight: 900, fontSize: '13pt', color: '#fff' }}>{meta.invoiceNo}</div>
              <div style={{ fontSize: '7pt', color: '#b3d9ff', marginTop: '0.5mm' }}>Dated: {meta.date}</div>
              {meta.dueDate && (
                <div style={{ fontSize: '7pt', color: '#ffcc80', marginTop: '0.3mm' }}>Due: {meta.dueDate}</div>
              )}
            </div>
            <div style={{ marginTop: '1.5mm', fontSize: '6.5pt', color: '#b3d9ff' }}>
              Place of Supply: <strong style={{ color: '#fff' }}>{meta.placeOfSupplyLabel}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── PARTY + META INFO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', margin: '3mm 0 2mm' }}>
        <ObParty title="Billed To (Customer)" party={billTo} accent={BLUE} />
        <ObParty title="Delivery / Ship To" party={delivery} accent={TEAL} />
      </div>

      {/* ── TRANSPORT + OTHER META ── */}
      {(meta.transport || meta.broker || meta.lrNo || meta.challanNo) && (
        <div style={{ border: `1px solid ${BORDER}`, background: BLUE_PALE, padding: '1.5mm 3mm', marginBottom: '2mm' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2mm', fontSize: '7.5pt' }}>
            {[
              ['Agent', meta.broker],
              ['Transport', meta.transport],
              ['Station', meta.station],
              ['L.R. No.', meta.lrNo],
              ['Challan No.', meta.challanNo],
              ['Order No.', meta.orderNo],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: '6pt', color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</div>
                <div style={{ fontWeight: 700, color: BLUE, marginTop: '0.3mm' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ITEM TABLE ── */}
      <table className="ob-tbl">
        <thead>
          <tr>
            <th style={{ width: '4%' }}>S.No.</th>
            <th style={{ width: '22%', textAlign: 'left' }}>Description of Goods</th>
            <th style={{ width: '6%' }}>HSN</th>
            <th style={{ width: '5%' }}>Lot</th>
            <th style={{ width: '4%' }}>Cut</th>
            <th style={{ width: '5%' }}>PCS</th>
            <th style={{ width: '7%' }}>Meters</th>
            <th style={{ width: '5%' }}>Unit</th>
            <th style={{ width: '8%' }}>Rate</th>
            <th style={{ width: '5%' }}>Disc.%</th>
            <th style={{ width: '10%' }}>Taxable</th>
            <th style={{ width: '5%' }}>GST%</th>
            <th style={{ width: '10%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(lines || []).map((line) => (
            <tr key={line.sno}>
              <td className="ob-ctr">
                <span style={{ fontWeight: 700, color: BLUE }}>{line.sno}</span>
              </td>
              <td>
                <div style={{ fontWeight: 700, color: DARK }}>{line.name}</div>
                <div style={{ fontSize: '6.5pt', color: MUTED, marginTop: '0.3mm' }}>
                  {[line.colour && `Col: ${line.colour}`, line.designNo && `Design: ${line.designNo}`, line.quality && `Qual: ${line.quality}`].filter(Boolean).join(' · ')}
                </div>
              </td>
              <td className="ob-ctr">
                <span className="ob-pill">{line.hsn}</span>
              </td>
              <td className="ob-ctr">{line.lot || '—'}</td>
              <td className="ob-ctr">{line.cut || '—'}</td>
              <td className="ob-num">{line.pcs || ''}</td>
              <td className="ob-num">{line.mts ? fmt.num(line.mts) : ''}</td>
              <td className="ob-ctr">{line.unit}</td>
              <td className="ob-num">{money(line.rate)}</td>
              <td className="ob-ctr">{line.dis1Per ? `${line.dis1Per}%` : '—'}</td>
              <td className="ob-num">{money(line.taxable)}</td>
              <td className="ob-ctr">{line.gstPer ? `${line.gstPer}%` : '—'}</td>
              <td className="ob-num" style={{ fontWeight: 700, color: BLUE }}>{money(line.total)}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 5 - (lines || []).length) }).map((_, i) => (
            <tr key={`e${i}`}>
              {Array.from({ length: 13 }).map((__, j) => <td key={j} style={{ height: '7mm' }}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="ob-ctr">TOTAL</td>
            <td className="ob-num">{totalPcs || ''}</td>
            <td className="ob-num">{totalMts ? fmt.num(totalMts) : ''}</td>
            <td colSpan={3}>&nbsp;</td>
            <td className="ob-num">{money(totals.taxable)}</td>
            <td>&nbsp;</td>
            <td className="ob-num" style={{ fontSize: '9pt' }}>₹ {money(totals.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── BANK + GST + TOTALS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginTop: '3mm' }}>
        {/* Bank */}
        <div style={{ border: `1px solid ${BORDER}`, padding: '2mm 3mm', background: BLUE_PALE }}>
          <div style={{ fontSize: '7pt', fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5mm', display: 'flex', alignItems: 'center', gap: '1mm' }}>
            <span style={{ display: 'inline-block', width: '4px', height: '4px', background: BLUE, borderRadius: '50%' }} />
            Bank &amp; Payment Details
          </div>
          {bank?.bankName ? (
            <table style={{ width: '100%', fontSize: '7.5pt', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Bank Name', `${bank.bankName}${bank.branch ? ` — ${bank.branch}` : ''}`],
                  ['Account No.', bank.accountNo],
                  ['IFSC Code', bank.ifsc],
                  bank.upiId ? ['UPI / VPA', bank.upiId] : null,
                ].filter(Boolean).map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ width: '35%', color: MUTED, paddingBottom: '0.8mm', fontWeight: 600 }}>{l}:</td>
                    <td style={{ fontWeight: 700, color: DARK, fontFamily: l === 'Account No.' || l === 'IFSC Code' ? 'monospace' : 'inherit' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: '7.5pt', color: MUTED }}>Bank details available on request</div>
          )}

          {/* Terms */}
          <div style={{ marginTop: '2mm', borderTop: `0.5px solid ${BORDER}`, paddingTop: '1.5mm', fontSize: '7pt', color: MUTED, lineHeight: 1.55 }}>
            <strong style={{ color: BLUE, display: 'block', marginBottom: '0.5mm' }}>Terms &amp; Conditions</strong>
            <ol style={{ margin: 0, paddingLeft: '3.5mm' }}>
              {(termsList || []).map((t) => <li key={t} style={{ marginBottom: '0.3mm' }}>{t}</li>)}
            </ol>
          </div>
        </div>

        {/* GST + Totals */}
        <div>
          {/* GST Table */}
          <table className="ob-tbl" style={{ fontSize: '7pt', marginBottom: '2mm' }}>
            <thead>
              <tr>
                <th>Tax %</th>
                <th style={{ textAlign: 'right' }}>Taxable</th>
                {isIgst ? <th style={{ textAlign: 'right' }}>IGST</th> : <><th>CGST%</th><th style={{ textAlign: 'right' }}>CGST</th><th>SGST%</th><th style={{ textAlign: 'right' }}>SGST</th></>}
                <th style={{ textAlign: 'right' }}>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {(taxRows || []).map((row) => (
                <tr key={row.taxPct}>
                  <td className="ob-ctr">{row.taxPct}%</td>
                  <td className="ob-num">{money(row.taxValue)}</td>
                  {isIgst ? (
                    <td className="ob-num">{money(row.igstAmt)}</td>
                  ) : (
                    <>
                      <td className="ob-ctr">{row.cgstPct}%</td>
                      <td className="ob-num">{money(row.cgstAmt)}</td>
                      <td className="ob-ctr">{row.sgstPct}%</td>
                      <td className="ob-num">{money(row.sgstAmt)}</td>
                    </>
                  )}
                  <td className="ob-num" style={{ fontWeight: 700 }}>{money(row.cgstAmt + row.sgstAmt + row.igstAmt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ border: `1px solid ${BORDER}`, background: BLUE_PALE }}>
            {buildTotalsRows(data).map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '1mm 3mm',
                background: row.accent ? BLUE : 'transparent',
                borderBottom: `0.3px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: '7.5pt', color: row.accent ? '#fff' : MUTED, fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                <span style={{ fontSize: row.accent ? '10pt' : '7.5pt', fontWeight: row.bold ? 800 : 400, color: row.accent ? '#fff' : DARK, fontFamily: 'monospace' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AMOUNT IN WORDS + SIGN ── */}
      <div style={{ marginTop: '3mm', display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', alignItems: 'end' }}>
        <div style={{ border: `1px solid ${BORDER}`, padding: '1.5mm 3mm', background: BLUE_LIGHT }}>
          <span style={{ fontSize: '7pt', color: MUTED, fontWeight: 700 }}>Amount in Words: </span>
          <span style={{ fontSize: '8pt', fontStyle: 'italic', color: DARK, fontWeight: 600 }}>{totals.amountWords}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7pt', color: MUTED }}>E. &amp; O.E.</div>
          <div style={{ fontWeight: 700, color: DARK }}>For {company?.name}</div>
          <div style={{ marginTop: '13mm', borderTop: `1px solid ${BLUE}`, paddingTop: '1.5mm', display: 'inline-block', fontSize: '7.5pt', color: MUTED }}>
            Authorised Signatory
          </div>
        </div>
      </div>
    </InvoicePrintRoot>
  );
}
