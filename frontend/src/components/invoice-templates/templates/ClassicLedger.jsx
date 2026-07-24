import React from 'react';
import { CompanyLogo, PartyBlock, SignatureBlock, InvoiceFooter } from '../shared/Blocks';
import { ItemTable, TotalsBlock, AmountInWords } from '../shared/ItemTable';
import { BankBlock } from '../shared/BankBlock';
import { MetaRow } from '../shared/FieldWarning';

const RED = '#9f1239';
const INK = '#0f172a';

/** Traditional Indian bill-book — double border, serif headings, ruled table */
export default function ClassicLedger({ data }) {
  const { company, meta, billTo, shipTo, isSale } = data;

  return (
    <div
      className="invoice-template classic-ledger"
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: INK,
        border: `3px double ${INK}`,
        padding: '8mm',
        minHeight: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          fontSize: 9,
          fontWeight: 800,
          color: RED,
          letterSpacing: '0.14em',
          border: `1px solid ${RED}`,
          padding: '2px 8px',
        }}
      >
        {data.copyLabel}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <CompanyLogo company={company} size={56} accent={INK} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em', color: RED }}>
            {company.name}
          </div>
          {company.tagline ? (
            <div style={{ fontSize: 10, fontStyle: 'italic', color: '#64748b' }}>{company.tagline}</div>
          ) : null}
          <div style={{ fontSize: 9, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>
            {[company.address, company.area].filter(Boolean).join(', ')}
            <br />
            Ph: {company.phone || '—'}
            {company.email ? ` · ${company.email}` : ''}
            {company.website ? ` · ${company.website}` : ''}
            <br />
            <strong style={{ color: INK }}>
              GSTIN: {company.gstin || '—'}
              {company.pan ? ` · PAN: ${company.pan}` : ''}
              {company.state ? ` · State: ${company.state}` : ''}
              {company.stateCode ? ` (${company.stateCode})` : ''}
            </strong>
          </div>
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          borderTop: `2px solid ${INK}`,
          borderBottom: `2px solid ${INK}`,
          padding: '6px 0',
          marginBottom: 12,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.2em',
          color: RED,
        }}
      >
        {data.docTitle}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr',
          gap: 12,
          marginBottom: 12,
          fontSize: 10,
        }}
      >
        <PartyBlock title="Bill To" party={billTo} accent={RED} />
        {shipTo ? <PartyBlock title="Ship To" party={shipTo} accent={RED} /> : <div />}
        <div>
          <MetaRow label="Invoice No." value={meta.invoiceNo} />
          <MetaRow label="Invoice Date" value={meta.date} />
          {meta.dueDate && <MetaRow label="Due Date" value={meta.dueDate} />}
          {meta.paymentTerms && <MetaRow label="Payment Terms" value={meta.paymentTerms} />}
          <MetaRow
            label="Place of Supply"
            value={`${meta.placeOfSupply}${meta.placeOfSupplyCode ? ` (${meta.placeOfSupplyCode})` : ''}`}
          />
          <MetaRow label="Reverse Charge" value={meta.reverseCharge} />
          {!isSale && meta.supplierInvoiceNo && (
            <MetaRow label="Supplier Bill" value={meta.supplierInvoiceNo} />
          )}
        </div>
      </div>

      {(meta.transport || meta.lrNo || meta.eway || meta.orderNo) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 14px',
            fontSize: 9,
            marginBottom: 8,
            border: '1px solid #e2e8f0',
            padding: '4px 8px',
          }}
        >
          {meta.orderNo && <span>Order: {meta.orderNo}</span>}
          {meta.challanNo && <span>Challan: {meta.challanNo}</span>}
          {meta.transport && <span>Transport: {meta.transport}</span>}
          {meta.lrNo && <span>LR: {meta.lrNo}</span>}
          {meta.station && <span>Station: {meta.station}</span>}
          {meta.eway && <span>E-Way: {meta.eway}</span>}
        </div>
      )}

      <ItemTable data={data} headerBg={INK} headerColor="#fff" zebra="#fafafa" />

      <div
        className="invoice-avoid-break"
        style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12, pageBreakInside: 'avoid' }}
      >
        <div>
          <AmountInWords words={data.totals.amountWords} accent={RED} bg="#fff5f5" />
          <BankBlock bank={data.bank} amount={data.totals.grandTotal} accent={RED} />
          <div style={{ marginTop: 8, fontSize: 9, color: '#475569' }}>
            <div style={{ fontWeight: 800, color: INK, marginBottom: 2 }}>Terms & Conditions</div>
            <div>{data.terms}</div>
            {meta.remarks ? (
              <div style={{ marginTop: 4 }}>
                <strong>Remarks:</strong> {meta.remarks}
              </div>
            ) : null}
          </div>
        </div>
        <TotalsBlock data={data} accent={INK} />
      </div>

      <SignatureBlock companyName={company.name} accent={RED} />
      <InvoiceFooter companyName={company.name} />
    </div>
  );
}
