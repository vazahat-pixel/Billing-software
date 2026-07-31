import React from 'react';
import { joinParts } from '../utils';
import { INK, PRINT_FONT } from '../constants';
import { InvoiceQr } from './QrCode';

export function CompanyLogo({ company, size = 56 }) {
  if (!company?.showLogo || !company?.logoUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          border: `1px solid ${INK.rule}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: PRINT_FONT.size.xs,
          color: INK.faint,
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {company?.name?.slice(0, 2).toUpperCase() || 'CO'}
      </div>
    );
  }
  return (
    <img
      src={company.logoUrl}
      alt={company.name}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}

export function CompanyIdentity({ company, align = 'left', showQr, data, compact = false }) {
  const contact = joinParts([company.phone, company.email, company.website]);
  const reg = joinParts([
    company.gstin ? `GSTIN: ${company.gstin}` : null,
    company.pan ? `PAN: ${company.pan}` : null,
  ]);

  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontWeight: 700, fontSize: compact ? PRINT_FONT.size.lg : PRINT_FONT.size.title, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
        {company.name}
      </div>
      {company.tagline && !compact ? (
        <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.muted, marginTop: '0.5mm', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {company.tagline}
        </div>
      ) : null}
      {company.addressFull || company.address ? (
        <div style={{ fontSize: PRINT_FONT.size.sm, color: INK.muted, marginTop: '1.5mm', lineHeight: 1.45 }}>
          {[company.addressFull || company.address, company.area].filter(Boolean).join(', ')}
        </div>
      ) : null}
      {reg ? <div style={{ fontSize: PRINT_FONT.size.xs, marginTop: '1.5mm', fontWeight: 600 }}>{reg}</div> : null}
      {contact ? <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.muted, marginTop: '1mm' }}>{contact}</div> : null}
    </div>
  );
}

/** Header row: logo + company left, QR right */
export function CompanyHeaderRow({ data, logoSize = 52 }) {
  const { company } = data;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4mm', alignItems: 'start' }}>
      <CompanyLogo company={company} size={logoSize} />
      <CompanyIdentity company={company} />
      <InvoiceQr data={data} size={64} label="E-Invoice QR" />
    </div>
  );
}

/** Centered luxury letterhead */
export function CompanyLetterhead({ data }) {
  const { company } = data;
  return (
    <div style={{ textAlign: 'center', paddingBottom: '3mm' }}>
      <CompanyLogo company={company} size={48} />
      <div style={{ marginTop: '2mm' }}>
        <CompanyIdentity company={company} align="center" />
      </div>
    </div>
  );
}
