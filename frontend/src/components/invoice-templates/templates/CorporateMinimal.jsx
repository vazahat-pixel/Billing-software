import React from 'react';
import { CompanyLogo, PartyBlock, SignatureBlock, InvoiceFooter } from '../shared/Blocks';
import { ItemTable, TotalsBlock, AmountInWords } from '../shared/ItemTable';
import { BankBlock } from '../shared/BankBlock';
import { MetaRow } from '../shared/FieldWarning';

const NAVY = '#0f172a';
const ACCENT = '#0f766e'; // emerald — Stripe-like modern

/** Clean sans-serif, generous whitespace, left letterhead */
export default function CorporateMinimal({ data }) {
  const { company, meta, billTo, shipTo } = data;

  return (
    <div
      className="invoice-template corporate-minimal"
      style={{
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        color: NAVY,
        padding: '12mm 14mm',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <CompanyLogo company={company} size={48} accent={ACCENT} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>{company.name}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.55, maxWidth: 280 }}>
              {[company.address, company.area].filter(Boolean).join(', ')}
              <br />
              {company.phone}
              {company.email ? ` · ${company.email}` : ''}
              {company.website ? (
                <>
                  <br />
                  {company.website}
                </>
              ) : null}
              <br />
              <span style={{ color: ACCENT, fontWeight: 600 }}>
                GSTIN {company.gstin || '—'}
                {company.stateCode ? ` · ${company.state} (${company.stateCode})` : ''}
              </span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: ACCENT,
              marginBottom: 8,
            }}
          >
            {data.docTitle}
          </div>
          <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: '0.08em' }}>{data.copyLabel}</div>
          <div style={{ marginTop: 12 }}>
            <MetaRow label="Invoice" value={meta.invoiceNo} />
            <MetaRow label="Date" value={meta.date} />
            {meta.dueDate && <MetaRow label="Due" value={meta.dueDate} />}
            <MetaRow label="RCM" value={meta.reverseCharge} />
          </div>
        </div>
      </div>

      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, ${ACCENT}, transparent)`,
          marginBottom: 20,
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 22 }}>
        <PartyBlock title="Bill To" party={billTo} accent={ACCENT} />
        {shipTo ? <PartyBlock title="Ship To" party={shipTo} accent={ACCENT} /> : <div />}
        <div style={{ fontSize: 10 }}>
          <MetaRow
            label="Place of Supply"
            value={`${meta.placeOfSupply}${meta.placeOfSupplyCode ? ` (${meta.placeOfSupplyCode})` : ''}`}
          />
          {meta.paymentTerms && <MetaRow label="Terms" value={meta.paymentTerms} />}
          {meta.transport && <MetaRow label="Transport" value={meta.transport} />}
          {meta.eway && <MetaRow label="E-Way Bill" value={meta.eway} />}
        </div>
      </div>

      <ItemTable data={data} headerBg={NAVY} headerColor="#fff" zebra="#f8fafc" />

      <div
        className="invoice-avoid-break"
        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 8 }}
      >
        <div>
          <AmountInWords words={data.totals.amountWords} accent={ACCENT} bg="#f0fdfa" />
          <BankBlock bank={data.bank} amount={data.totals.grandTotal} accent={ACCENT} />
          <div style={{ marginTop: 12, fontSize: 9, color: '#64748b', maxWidth: 360 }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 2 }}>Terms</div>
            {data.terms}
          </div>
        </div>
        <TotalsBlock data={data} accent={ACCENT} />
      </div>

      <SignatureBlock companyName={company.name} accent={ACCENT} />
      <InvoiceFooter companyName={company.name} />
    </div>
  );
}
