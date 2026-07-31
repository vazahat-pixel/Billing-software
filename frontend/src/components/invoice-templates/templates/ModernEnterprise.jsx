/**
 * Style 1 — Modern Enterprise ERP
 * Structure: Split header · meta strip · dual party cards · GST table · tax summary · right totals
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { CompanyHeaderRow } from '../engine/primitives/CompanyBlock';
import { DocTitleBand } from '../engine/primitives/MetaBlock';
import { MetaStrip } from '../engine/primitives/MetaBlock';
import { DualPartyRow } from '../engine/primitives/PartyBlock';
import DynamicItemTable from '../engine/primitives/DynamicItemTable';
import TotalsPanel, { TaxSummaryTable } from '../engine/primitives/TotalsPanel';
import { InvoiceFooter } from '../engine/primitives/FooterBlock';
import { INK } from '../engine/constants';

export default function ModernEnterprise({ data }) {
  return (
    <InvoicePrintRoot templateId="modern-enterprise" data={data}>
      <CompanyHeaderRow data={data} logoSize={54} />
      <DocTitleBand data={data} />
      <MetaStrip data={data} columns={4} />
      <DualPartyRow billTo={data.billTo} shipTo={data.shipTo} variant="card" accent={INK.black} />

      <DynamicItemTable data={data} templateId="modern-enterprise" variant="standard" />

      <div style={{ display: 'grid', gridTemplateColumns: '52% 46%', gap: '2%', marginTop: '2mm', alignItems: 'start' }}>
        <TaxSummaryTable data={data} />
        <TotalsPanel data={data} variant="right" width="100%" />
      </div>

      <InvoiceFooter data={data} bankLayout="horizontal" />
    </InvoicePrintRoot>
  );
}
