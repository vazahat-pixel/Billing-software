import React from 'react';
import { CompanyLogo, PartyBlock, SignatureBlock, InvoiceFooter } from '../shared/Blocks';
import { ItemTable, TotalsBlock, AmountInWords } from '../shared/ItemTable';
import { BankBlock } from '../shared/BankBlock';
import { MetaRow } from '../shared/FieldWarning';
import { FestivalMotifs, FestivalGreeting } from '../shared/FestivalMotifs';

/** Festival edition — thin decorative motifs, print-safe accents */
export default function FestiveEdition({ data }) {
  const { company, meta, billTo, shipTo, festival } = data;
  const primary = festival?.accents?.primary || '#7f1d1d';
  const secondary = festival?.accents?.secondary || '#d97706';
  const motif = festival?.motif || 'marigold';

  return (
    <div
      className="invoice-template festive-edition"
      style={{
        fontFamily: "Georgia, 'Segoe UI', serif",
        color: '#1c1917',
        minHeight: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        border: `1.5px solid ${primary}`,
        padding: '8mm',
      }}
    >
      <FestivalMotifs motif={motif} accents={{ primary, secondary }} variant="corners" />
      <FestivalMotifs motif={motif} accents={{ primary, secondary }} variant="border" />

      <div style={{ position: 'relative', zIndex: 1, marginTop: 6 }}>
        {data.showFestivalGreeting && (
          <FestivalGreeting greeting={festival?.greeting} accent={primary} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <CompanyLogo company={company} size={50} accent={primary} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: primary }}>{company.name}</div>
              <div style={{ fontSize: 9, color: '#57534e', lineHeight: 1.45, marginTop: 2 }}>
                {[company.address, company.area].filter(Boolean).join(', ')}
                <br />
                Ph: {company.phone || '—'}
                {company.email ? ` · ${company.email}` : ''}
                <br />
                <strong>
                  GSTIN: {company.gstin || '—'}
                  {company.state ? ` · ${company.state}` : ''}
                  {company.stateCode ? ` (${company.stateCode})` : ''}
                </strong>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                display: 'inline-block',
                background: primary,
                color: '#fffbeb',
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
              }}
            >
              {data.docTitle}
            </div>
            <div style={{ fontSize: 9, marginTop: 6, color: secondary, fontWeight: 700 }}>
              {data.copyLabel}
            </div>
            {festival?.name && (
              <div style={{ fontSize: 8, marginTop: 4, color: '#78716c' }}>{festival.name}</div>
            )}
          </div>
        </div>

        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${primary}, ${secondary}, ${primary})`,
            marginBottom: 12,
            opacity: 0.7,
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <PartyBlock title="Bill To" party={billTo} accent={primary} />
          {shipTo ? <PartyBlock title="Ship To" party={shipTo} accent={primary} /> : <div />}
          <div>
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

        <ItemTable data={data} headerBg={primary} headerColor="#fffbeb" zebra="#fff7ed" />

        <div
          className="invoice-avoid-break"
          style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}
        >
          <div>
            <AmountInWords words={data.totals.amountWords} accent={primary} bg="#fff7ed" />
            <BankBlock bank={data.bank} amount={data.totals.grandTotal} accent={primary} />
            <div style={{ marginTop: 8, fontSize: 9, color: '#57534e' }}>
              <div style={{ fontWeight: 800, color: primary, marginBottom: 2 }}>Terms & Conditions</div>
              {data.terms}
            </div>
          </div>
          <TotalsBlock data={data} accent={primary} />
        </div>

        <SignatureBlock companyName={company.name} accent={secondary} />
        <InvoiceFooter companyName={company.name} />
      </div>
    </div>
  );
}
