import React from 'react';
import { addressLines, hasValue, joinParts } from '../utils';
import { INK, PRINT_FONT } from '../constants';

export function PartyBlock({ party, title = 'Bill To', variant = 'card', accent }) {
  if (!party) return null;
  const lines = addressLines(party);

  if (variant === 'plain') {
    return (
      <div>
        <div className="ipe-upper" style={{ fontSize: PRINT_FONT.size.xs, color: INK.faint, marginBottom: '1.5mm' }}>
          {title}
        </div>
        <div style={{ fontWeight: 700, fontSize: PRINT_FONT.size.md, marginBottom: '1mm' }}>{party.name}</div>
        {lines.map((l) => (
          <div key={l} style={{ fontSize: PRINT_FONT.size.sm, color: INK.muted, lineHeight: 1.45 }}>{l}</div>
        ))}
        <PartyMeta party={party} />
      </div>
    );
  }

  if (variant === 'framed') {
    return (
      <div style={{ border: `1px solid ${INK.ruleDark}`, padding: '3mm' }}>
        <div className="ipe-upper" style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, marginBottom: '2mm', letterSpacing: '0.1em' }}>
          {title}
        </div>
        <div style={{ fontWeight: 700, fontSize: PRINT_FONT.size.lg, marginBottom: '1.5mm' }}>{party.name}</div>
        {lines.map((l) => (
          <div key={l} style={{ fontSize: PRINT_FONT.size.sm, lineHeight: 1.5 }}>{l}</div>
        ))}
        <PartyMeta party={party} />
      </div>
    );
  }

  // card — left accent stripe
  return (
    <div style={{ borderLeft: `3px solid ${accent || INK.ruleDark}`, paddingLeft: '3mm' }}>
      <div className="ipe-upper" style={{ fontSize: PRINT_FONT.size.xs, color: INK.faint, marginBottom: '1.5mm', fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontWeight: 700, fontSize: PRINT_FONT.size.md }}>{party.name}</div>
      {lines.map((l) => (
        <div key={l} style={{ fontSize: PRINT_FONT.size.sm, color: INK.muted, lineHeight: 1.45 }}>{l}</div>
      ))}
      <PartyMeta party={party} />
    </div>
  );
}

function PartyMeta({ party }) {
  const items = [
    party.gstin ? `GSTIN: ${party.gstin}` : null,
    party.stateLabel ? `State: ${party.stateLabel}` : null,
    party.phone ? `Ph: ${party.phone}` : null,
    party.email ? party.email : null,
  ].filter(Boolean);

  if (!items.length) return null;
  return (
    <div style={{ marginTop: '2mm', fontSize: PRINT_FONT.size.xs, color: INK.muted, lineHeight: 1.5 }}>
      {items.map((item) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}

export function TransportBlock({ meta }) {
  const fields = [
    { label: 'Transport', value: meta.transport },
    { label: 'LR No', value: meta.lrNo },
    { label: 'Station', value: meta.station },
    { label: 'Broker', value: meta.broker },
    { label: 'Haste', value: meta.haste },
    { label: 'Bale No', value: meta.baleNo },
    { label: 'Weight', value: meta.weight ? `${meta.weight} Kg` : '' },
    { label: 'Delivery', value: meta.station },
  ].filter((f) => hasValue(f.value));

  if (!fields.length) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '2mm',
        marginTop: '3mm',
        padding: '2mm 0',
        borderTop: `0.5px solid ${INK.rule}`,
        borderBottom: `0.5px solid ${INK.rule}`,
        fontSize: PRINT_FONT.size.xs,
      }}
    >
      {fields.map((f) => (
        <div key={f.label}>
          <span style={{ color: INK.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}: </span>
          <span style={{ fontWeight: 600 }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DualPartyRow({ billTo, shipTo, variant = 'card' }) {
  const same = billTo?.name === shipTo?.name && billTo?.address === shipTo?.address;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: same ? '1fr' : '1fr 1fr', gap: '5mm', marginTop: '4mm' }}>
      <PartyBlock party={billTo} title="Bill To" variant={variant} />
      {!same && shipTo ? <PartyBlock party={shipTo} title="Ship To" variant={variant} /> : null}
    </div>
  );
}
