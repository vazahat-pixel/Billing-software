import React from 'react';
import { metaFields, hasValue } from '../utils';
import { INK, PRINT_FONT } from '../constants';

/** Horizontal meta strip — used in enterprise layout */
export function MetaStrip({ data, columns = 4 }) {
  const fields = metaFields(data);
  if (!fields.length) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '2mm 4mm',
        marginTop: '4mm',
        padding: '2.5mm 0',
        borderTop: `1px solid ${INK.rule}`,
        borderBottom: `1px solid ${INK.rule}`,
        fontSize: PRINT_FONT.size.xs,
      }}
    >
      {fields.map((f) => (
        <div key={f.label}>
          <div style={{ color: INK.faint, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '6.5pt' }}>
            {f.label}
          </div>
          <div style={{ fontWeight: 600, marginTop: '0.5mm' }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Right-aligned invoice meta panel */
export function MetaPanel({ data, title }) {
  const { meta, docTitle, copyLabel } = data;
  const rows = [
    { label: 'Invoice No', value: meta.invoiceNo },
    { label: 'Date', value: meta.date },
    { label: 'Due Date', value: meta.dueDate },
    { label: 'Order No', value: meta.orderNo },
    { label: 'Payment Terms', value: meta.paymentTerms },
    { label: 'Reverse Charge', value: meta.reverseCharge },
  ].filter((r) => hasValue(r.value));

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: PRINT_FONT.size.hero, fontWeight: 300, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>
        {title || docTitle}
      </div>
      {copyLabel && copyLabel !== 'ORIGINAL' ? (
        <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.faint, marginTop: '1mm' }}>{copyLabel}</div>
      ) : null}
      <table style={{ marginTop: '3mm', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: PRINT_FONT.size.sm }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={{ padding: '0.5mm 3mm 0.5mm 0', color: INK.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.label}</td>
              <td style={{ padding: '0.5mm 0', fontWeight: 600, textAlign: 'right' }}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Boxed meta for international layout */
export function MetaBox({ data }) {
  const { meta, docTitle } = data;
  const items = [
    ['Document', docTitle],
    ['Number', meta.invoiceNo],
    ['Date', meta.date],
    ['Due', meta.dueDate],
    ['Order Ref', meta.orderNo],
    ['Terms', meta.paymentTerms],
    ['Place of Supply', meta.placeOfSupplyLabel],
  ].filter(([, v]) => hasValue(v));

  return (
    <div style={{ border: `1px solid ${INK.ruleDark}`, padding: '3mm' }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '3mm', padding: '0.8mm 0', fontSize: PRINT_FONT.size.sm, borderBottom: `0.5px solid ${INK.rule}` }}>
          <span style={{ color: INK.muted }}>{label}</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/** Document title band */
export function DocTitleBand({ data, style = 'underline' }) {
  const { docTitle, copyLabel } = data;
  if (style === 'centered') {
    return (
      <div style={{ textAlign: 'center', margin: '4mm 0' }}>
        <div style={{ fontSize: PRINT_FONT.size.xl, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {docTitle}
        </div>
        {copyLabel && copyLabel !== 'ORIGINAL' ? (
          <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.faint, marginTop: '1mm' }}>{copyLabel}</div>
        ) : null}
        <hr className="ipe-rule-double" style={{ margin: '2mm auto 0', width: '40%' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3mm', paddingBottom: '2mm', borderBottom: `2px solid ${INK.black}` }}>
      <div style={{ fontSize: PRINT_FONT.size.lg, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {docTitle}
      </div>
      <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.muted }}>
        {metaFields(data).slice(0, 3).map((f) => `${f.label}: ${f.value}`).join('  |  ')}
      </div>
    </div>
  );
}
