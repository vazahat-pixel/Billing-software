import React from 'react';
import { CompanyLogo, PartyBlock, SignatureBlock, InvoiceFooter } from '../shared/Blocks';
import { ItemTable, TotalsBlock, AmountInWords } from '../shared/ItemTable';
import { BankBlock } from '../shared/BankBlock';
import { MetaRow } from '../shared/FieldWarning';

const GOLD = '#a16207';
const MAROON = '#7f1d1d';
const CREAM = '#fffbeb';

/** Premium gold/maroon letterhead band for high-value clients */
export default function GoldLetterhead({ data }) {
  const { company, meta, billTo, shipTo } = data;

  return (
    <div
      className="invoice-template gold-letterhead"
      style={{
        fontFamily: "Georgia, 'Palatino Linotype', serif",
        color: '#1c1917',
        minHeight: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        background: `
          radial-gradient(ellipse at 10% 0%, rgba(161,98,7,0.04), transparent 50%),
          radial-gradient(ellipse at 90% 100%, rgba(127,29,29,0.03), transparent 45%),
          #ffffff
        `,
      }}
    >
      {/* Embossed-style header band */}
      <div
        style={{
          background: `linear-gradient(180deg, ${MAROON} 0%, #991b1b 100%)`,
          color: '#fef3c7',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderBottom: `3px solid ${GOLD}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        <div
          style={{
            padding: 4,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 4,
            border: `1px solid ${GOLD}`,
          }}
        >
          <CompanyLogo company={company} size={48} accent={GOLD} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textShadow: '0 1px 0 rgba(0,0,0,0.35)',
            }}
          >
            {company.name}
          </div>
          {company.tagline ? (
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{company.tagline}</div>
          ) : null}
          <div style={{ fontSize: 9, marginTop: 4, opacity: 0.9, lineHeight: 1.4 }}>
            {[company.address, company.area].filter(Boolean).join(', ')}
            <br />
            GSTIN: {company.gstin || '—'}
            {company.pan ? ` · PAN: ${company.pan}` : ''}
            {company.phone ? ` · ${company.phone}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: GOLD }}>
            {data.docTitle}
          </div>
          <div style={{ fontSize: 9, marginTop: 4, opacity: 0.8 }}>{data.copyLabel}</div>
        </div>
      </div>

      <div style={{ height: 2, background: `linear-gradient(90deg, ${GOLD}, ${MAROON}, ${GOLD})` }} />

      <div style={{ padding: '10mm 12mm 12mm' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <PartyBlock title="Bill To" party={billTo} accent={MAROON} />
          {shipTo ? <PartyBlock title="Ship To" party={shipTo} accent={MAROON} /> : <div />}
          <div
            style={{
              background: CREAM,
              border: `1px solid ${GOLD}`,
              padding: '8px 10px',
              borderRadius: 2,
            }}
          >
            <MetaRow label="Invoice No." value={meta.invoiceNo} />
            <MetaRow label="Date" value={meta.date} />
            {meta.dueDate && <MetaRow label="Due Date" value={meta.dueDate} />}
            <MetaRow
              label="Place of Supply"
              value={`${meta.placeOfSupply}${meta.placeOfSupplyCode ? ` (${meta.placeOfSupplyCode})` : ''}`}
            />
            <MetaRow label="Reverse Charge" value={meta.reverseCharge} />
          </div>
        </div>

        <ItemTable data={data} headerBg={MAROON} headerColor="#fef3c7" zebra="#fffbeb" />

        <div
          className="invoice-avoid-break"
          style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}
        >
          <div>
            <AmountInWords words={data.totals.amountWords} accent={MAROON} bg={CREAM} />
            <BankBlock bank={data.bank} amount={data.totals.grandTotal} accent={MAROON} />
            <div style={{ marginTop: 8, fontSize: 9, color: '#57534e' }}>
              <div style={{ fontWeight: 800, color: MAROON, marginBottom: 2 }}>Terms & Conditions</div>
              {data.terms}
            </div>
          </div>
          <TotalsBlock data={data} accent={MAROON} />
        </div>

        <SignatureBlock companyName={company.name} accent={GOLD} />
        <InvoiceFooter companyName={company.name} />
      </div>
    </div>
  );
}
