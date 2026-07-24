import React from 'react';

export function CompanyLogo({ company, size = 52, accent = '#0f172a' }) {
  if (company.showLogo && company.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: accent,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {(company.name || 'C').charAt(0)}
    </div>
  );
}

export function PartyBlock({ title, party, accent = '#0f172a' }) {
  if (!party) return null;
  return (
    <div style={{ fontSize: 10, lineHeight: 1.5, color: '#334155' }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 800,
          color: accent,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 4,
          borderBottom: `1px solid ${accent}`,
          paddingBottom: 2,
          display: 'inline-block',
        }}
      >
        {title}
      </div>
      <div style={{ fontWeight: 800, fontSize: 12, color: '#0f172a' }}>
        {party.name || '—'}
      </div>
      {party.address ? <div>{party.address}</div> : <div style={{ color: '#94a3b8' }}>Address —</div>}
      {(party.state || party.stateCode) && (
        <div>
          State: {party.state || '—'}
          {party.stateCode ? ` (${party.stateCode})` : ''}
        </div>
      )}
      {party.gstin ? (
        <div style={{ fontWeight: 700 }}>GSTIN: {party.gstin}</div>
      ) : (
        <div style={{ color: '#64748b', fontSize: 9 }}>GSTIN: Unregistered</div>
      )}
      {party.phone ? <div>Ph: {party.phone}</div> : null}
    </div>
  );
}

export function SignatureBlock({ companyName, accent = '#0f172a' }) {
  return (
    <div
      className="invoice-avoid-break"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 24,
        marginTop: 20,
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ height: 36 }} />
        <div
          style={{
            borderTop: '1px solid #94a3b8',
            paddingTop: 6,
            fontSize: 8,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Receiver&apos;s Signature
        </div>
      </div>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>For {companyName}</div>
        <div style={{ height: 28 }} />
        <div
          style={{
            borderTop: `1.5px solid ${accent}`,
            paddingTop: 6,
            fontSize: 8,
            fontWeight: 800,
            color: accent,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Authorised Signatory
        </div>
      </div>
    </div>
  );
}

export function InvoiceFooter({ companyName }) {
  return (
    <div
      className="invoice-page-footer"
      style={{
        marginTop: 14,
        paddingTop: 8,
        borderTop: '1px dashed #cbd5e1',
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
        letterSpacing: '0.04em',
      }}
    >
      This is a computer-generated invoice · {companyName}
      <span className="invoice-page-num" style={{ float: 'right' }} />
    </div>
  );
}
