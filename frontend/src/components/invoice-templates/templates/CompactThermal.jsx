import React from 'react';

/**
 * Compact thermal / POS roll — 58mm or 80mm, text-only, no color dependency.
 * pageSize prop: 'thermal-80' | 'thermal-58'
 */
export default function CompactThermal({ data, pageSize = 'thermal-80' }) {
  const width = pageSize === 'thermal-58' ? '48mm' : '68mm';
  const { company, meta, billTo, lines, totals, fmt, isIgst, bank } = data;
  const mono = "'Courier New', Courier, monospace";

  const line = (left, right) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{left}</span>
      <span style={{ flexShrink: 0 }}>{right}</span>
    </div>
  );

  return (
    <div
      className="invoice-template compact-thermal"
      style={{
        width,
        maxWidth: '100%',
        margin: '0 auto',
        fontFamily: mono,
        fontSize: 10,
        color: '#000',
        background: '#fff',
        padding: '4mm 3mm',
        boxSizing: 'border-box',
        lineHeight: 1.35,
      }}
    >
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>{company.name}</div>
      <div style={{ textAlign: 'center', fontSize: 9 }}>
        {[company.address, company.area].filter(Boolean).join(', ')}
      </div>
      <div style={{ textAlign: 'center', fontSize: 9 }}>
        Ph: {company.phone || '—'}
      </div>
      <div style={{ textAlign: 'center', fontSize: 9 }}>GSTIN: {company.gstin || '—'}</div>
      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', margin: '6px 0', padding: '4px 0', textAlign: 'center', fontWeight: 700 }}>
        {data.docTitle}
        <br />
        {data.copyLabel}
      </div>

      {line('Inv:', meta.invoiceNo)}
      {line('Date:', meta.date)}
      {line('Party:', billTo.name)}
      {billTo.gstin ? line('GSTIN:', billTo.gstin) : null}
      {line('POS:', meta.placeOfSupply)}
      {line('RCM:', meta.reverseCharge)}

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      {line('ITEM', 'AMT')}
      <div style={{ borderTop: '1px dashed #000', margin: '2px 0 4px' }} />

      {lines.map((l) => (
        <div key={l.sno} style={{ marginBottom: 4, pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 700 }}>
            {l.sno}. {l.name}
          </div>
          <div style={{ fontSize: 9 }}>
            HSN {l.hsn} | {fmt.num(l.qty)} {l.unit} x {fmt.num(l.rate)}
          </div>
          {line('', fmt.num(l.total))}
        </div>
      ))}

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      {line('Taxable', fmt.money(totals.taxable))}
      {!isIgst ? (
        <>
          {line('CGST', fmt.money(totals.cgst))}
          {line('SGST', fmt.money(totals.sgst))}
        </>
      ) : (
        line('IGST', fmt.money(totals.igst))
      )}
      {totals.roundOff !== 0 && line('Round Off', fmt.money(totals.roundOff))}
      <div style={{ borderTop: '1px solid #000', marginTop: 4, paddingTop: 4, fontWeight: 700, fontSize: 12 }}>
        {line('TOTAL', fmt.money(totals.grandTotal))}
      </div>

      <div style={{ marginTop: 6, fontSize: 8, textAlign: 'center' }}>{totals.amountWords}</div>

      {(bank.upiId || bank.accountNo) && (
        <div style={{ marginTop: 8, fontSize: 8, borderTop: '1px dashed #000', paddingTop: 4 }}>
          {bank.bankName ? <div>{bank.bankName}</div> : null}
          {bank.accountNo ? <div>A/c: {bank.accountNo}</div> : null}
          {bank.ifsc ? <div>IFSC: {bank.ifsc}</div> : null}
          {bank.upiId ? <div>UPI: {bank.upiId}</div> : null}
        </div>
      )}

      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 8 }}>
        Thank you
        <br />
        Computer generated
      </div>
    </div>
  );
}
