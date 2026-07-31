/**
 * Style 5 — High-end International Business Invoice
 * Structure: Split column header · boxed meta · international addressing · separate tax table
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { CompanyIdentity, CompanyLogo } from '../engine/primitives/CompanyBlock';
import { MetaBox } from '../engine/primitives/MetaBlock';
import { PartyBlock } from '../engine/primitives/PartyBlock';
import DynamicItemTable from '../engine/primitives/DynamicItemTable';
import TotalsPanel, { TaxSummaryTable } from '../engine/primitives/TotalsPanel';
import { BankSection, TermsSection, DeclarationBlock, SignatureStrip } from '../engine/primitives/FooterBlock';
import { InvoiceQr } from '../engine/primitives/QrCode';
import { INK, PRINT_FONT } from '../engine/constants';

export default function InternationalBiz({ data }) {
  return (
    <InvoicePrintRoot templateId="international-biz" data={data}>
      {/* Two-column international header */}
      <div style={{ display: 'grid', gridTemplateColumns: '58% 38%', gap: '4%', alignItems: 'start' }}>
        <div style={{ display: 'flex', gap: '4mm' }}>
          <CompanyLogo company={data.company} size={50} />
          <div>
            <CompanyIdentity company={data.company} />
            <div style={{ marginTop: '3mm', fontSize: PRINT_FONT.size.xs, color: INK.muted, lineHeight: 1.6 }}>
              <div><strong>Tax Registration:</strong> {data.company?.gstin || '—'}</div>
              <div><strong>PAN:</strong> {data.company?.pan || '—'}</div>
              <div><strong>Place of Supply:</strong> {data.meta?.placeOfSupplyLabel || '—'}</div>
            </div>
          </div>
        </div>
        <div>
          <MetaBox data={data} />
          <div style={{ marginTop: '3mm', display: 'flex', justifyContent: 'flex-end' }}>
            <InvoiceQr data={data} size={68} label="Invoice QR" />
          </div>
        </div>
      </div>

      <hr className="ipe-rule-dark" style={{ margin: '4mm 0' }} />

      {/* International party layout — stacked with clear labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm' }}>
        <div>
          <div style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2mm', color: INK.dark }}>
            Bill To / Buyer
          </div>
          <PartyBlock party={data.billTo} variant="plain" />
        </div>
        <div>
          <div style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2mm', color: INK.dark }}>
            Ship To / Consignee
          </div>
          <PartyBlock party={data.shipTo || data.billTo} variant="plain" />
        </div>
      </div>

      {/* Line items with international columns */}
      <div style={{ marginTop: '5mm' }}>
        <div style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2mm' }}>
          Invoice Line Items
        </div>
        <DynamicItemTable data={data} templateId="international-biz" />
      </div>

      {/* Tax summary + totals side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 42%', gap: '3%', marginTop: '4mm' }}>
        <div>
          <div style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, textTransform: 'uppercase', marginBottom: '2mm' }}>
            Tax Summary (GST)
          </div>
          <TaxSummaryTable data={data} />
        </div>
        <TotalsPanel data={data} variant="ledger" width="100%" />
      </div>

      {/* Payment instructions */}
      <div style={{ marginTop: '5mm', padding: '3mm', border: `0.5px solid ${INK.rule}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5mm' }}>
        <BankSection bank={data.bank} amount={data.totals?.grandTotal} layout="stacked" />
        <div>
          <TermsSection data={data} />
          <div style={{ marginTop: '2mm' }}>
            <DeclarationBlock />
          </div>
        </div>
      </div>

      <SignatureStrip companyName={data.company?.name} layout="triple" />
    </InvoicePrintRoot>
  );
}
