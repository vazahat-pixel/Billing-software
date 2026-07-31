/**
 * Style 2 — Luxury Corporate Invoice
 * Structure: Centered letterhead · ornamental rules · framed customer · elegant totals ledger
 */
import React from 'react';
import InvoicePrintRoot from '../engine/InvoicePrintRoot';
import { CompanyLetterhead } from '../engine/primitives/CompanyBlock';
import { DocTitleBand } from '../engine/primitives/MetaBlock';
import { PartyBlock } from '../engine/primitives/PartyBlock';
import DynamicItemTable from '../engine/primitives/DynamicItemTable';
import TotalsPanel from '../engine/primitives/TotalsPanel';
import { InvoiceFooter } from '../engine/primitives/FooterBlock';
import { InvoiceQr } from '../engine/primitives/QrCode';
import { INK, PRINT_FONT } from '../engine/constants';
import { metaFields } from '../engine/utils';

export default function LuxuryCorporate({ data }) {
  const meta = metaFields(data).slice(0, 6);

  return (
    <InvoicePrintRoot templateId="luxury-corporate" data={data}>
      <hr className="ipe-rule-dark" style={{ marginBottom: '3mm' }} />
      <CompanyLetterhead data={data} />
      <hr className="ipe-rule-dark" style={{ marginTop: '3mm' }} />

      <DocTitleBand data={data} style="centered" />

      {/* Invoice meta in elegant two-row grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2mm',
          margin: '3mm 0',
          fontSize: PRINT_FONT.size.sm,
          textAlign: 'center',
        }}
      >
        {meta.map((f) => (
          <div key={f.label}>
            <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {f.label}
            </div>
            <div style={{ fontWeight: 600, marginTop: '0.5mm' }}>{f.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5mm', marginTop: '2mm' }}>
        <PartyBlock party={data.billTo} title="Invoiced To" variant="framed" />
        <InvoiceQr data={data} size={72} label="Verification QR" />
      </div>

      {data.shipTo && data.shipTo.name !== data.billTo?.name ? (
        <div style={{ marginTop: '3mm' }}>
          <PartyBlock party={data.shipTo} title="Deliver To" variant="framed" />
        </div>
      ) : null}

      <DynamicItemTable data={data} templateId="luxury-corporate" variant="luxury" />

      <TotalsPanel data={data} variant="ledger" width="42%" />

      <InvoiceFooter data={data} bankLayout="stacked" />
    </InvoicePrintRoot>
  );
}
