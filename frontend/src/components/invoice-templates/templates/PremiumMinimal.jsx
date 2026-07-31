/**
 * Style 3 — Premium Minimal Invoice
 * Structure: Maximum whitespace · right meta only · plain party · hairline table · inline totals
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { CompanyIdentity, CompanyLogo } from '../engine/primitives/CompanyBlock';
import { MetaPanel } from '../engine/primitives/MetaBlock';
import { PartyBlock } from '../engine/primitives/PartyBlock';
import DynamicItemTable from '../engine/primitives/DynamicItemTable';
import TotalsPanel from '../engine/primitives/TotalsPanel';
import { BankSection, TermsSection, SignatureStrip } from '../engine/primitives/FooterBlock';
import { INK, PRINT_FONT } from '../engine/constants';

export default function PremiumMinimal({ data }) {
  return (
    <InvoicePrintRoot templateId="premium-minimal" data={data}>
      {/* Asymmetric header — company left, invoice meta right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 38%', gap: '8mm', alignItems: 'start', marginBottom: '8mm' }}>
        <div style={{ display: 'flex', gap: '4mm', alignItems: 'flex-start' }}>
          <CompanyLogo company={data.company} size={44} />
          <CompanyIdentity company={data.company} compact />
        </div>
        <MetaPanel data={data} title={data.docTitle} />
      </div>

      <hr className="ipe-rule" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10mm', margin: '6mm 0' }}>
        <PartyBlock party={data.billTo} title="Bill To" variant="plain" />
        {data.shipTo?.name !== data.billTo?.name ? (
          <PartyBlock party={data.shipTo} title="Ship To" variant="plain" />
        ) : (
          <div />
        )}
      </div>

      <DynamicItemTable
        data={data}
        templateId="premium-minimal"
        variant="minimal"
        headerStyle={{ borderBottom: `0.5px solid ${INK.rule}`, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}
        cellStyle={{ padding: '3mm 1.5mm' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 42%', gap: '8mm', marginTop: '6mm' }}>
        <div>
          <BankSection bank={data.bank} amount={data.totals?.grandTotal} layout="stacked" compact />
        </div>
        <TotalsPanel data={data} variant="inline" />
      </div>

      <div style={{ marginTop: '8mm' }}>
        <TermsSection data={data} numbered={false} />
      </div>

      <SignatureStrip companyName={data.company?.name} layout="dual" />
    </InvoicePrintRoot>
  );
}
