import React from 'react';
import { UpiQr } from './QrCode';
import { INK, PRINT_FONT } from '../constants';

export function BankSection({ bank, amount, layout = 'horizontal', compact = false }) {
  const hasBank = !!(bank?.bankName || bank?.accountNo || bank?.ifsc);
  if (!hasBank && !bank?.upiId) return null;

  if (layout === 'stacked') {
    return (
      <div style={{ fontSize: PRINT_FONT.size.sm }}>
        <div className="ipe-upper" style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, marginBottom: '2mm', color: INK.dark }}>
          Bank Details
        </div>
        {hasBank ? (
          <>
            <div style={{ fontWeight: 600 }}>{bank.accountName}</div>
            <div style={{ color: INK.muted }}>{bank.bankName}{bank.branch ? ` · ${bank.branch}` : ''}</div>
            <div>A/c: <span className="ipe-tabular">{bank.accountNo || '—'}</span> · IFSC: {bank.ifsc || '—'}</div>
          </>
        ) : (
          <div style={{ color: INK.faint }}>Bank details not configured</div>
        )}
        {bank?.upiId ? (
          <div style={{ marginTop: '3mm', display: 'flex', gap: '3mm', alignItems: 'center' }}>
            <UpiQr upiId={bank.upiId} payeeName={bank.accountName} amount={amount} size={compact ? 56 : 68} />
            <div>
              <div style={{ fontWeight: 700, fontSize: PRINT_FONT.size.xs }}>UPI PAYMENT</div>
              <div style={{ fontSize: PRINT_FONT.size.sm }}>{bank.upiId}</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: bank?.upiId ? '1fr auto' : '1fr', gap: '4mm', fontSize: PRINT_FONT.size.sm }}>
      <div>
        <div className="ipe-upper" style={{ fontSize: PRINT_FONT.size.xs, fontWeight: 700, marginBottom: '2mm' }}>
          Bank Details
        </div>
        {hasBank ? (
          <>
            <div>{bank.accountName}</div>
            <div style={{ color: INK.muted }}>{bank.bankName}{bank.branch ? ` · ${bank.branch}` : ''}</div>
            <div>A/c: {bank.accountNo || '—'} · IFSC: {bank.ifsc || '—'}</div>
          </>
        ) : null}
      </div>
      {bank?.upiId ? (
        <div style={{ textAlign: 'center' }}>
          <UpiQr upiId={bank.upiId} payeeName={bank.accountName} amount={amount} size={68} />
          <div style={{ fontSize: PRINT_FONT.size.xs, marginTop: '1mm' }}>{bank.upiId}</div>
        </div>
      ) : null}
    </div>
  );
}

export function TermsSection({ data, numbered = true }) {
  const { termsList } = data;
  if (!termsList?.length) return null;

  return (
    <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.muted, lineHeight: 1.55 }}>
      <div className="ipe-upper" style={{ fontWeight: 700, color: INK.dark, marginBottom: '1.5mm', fontSize: PRINT_FONT.size.xs }}>
        Terms & Conditions
      </div>
      <ol style={{ margin: 0, paddingLeft: numbered ? '4mm' : 0, listStyle: numbered ? 'decimal' : 'none' }}>
        {termsList.map((t) => (
          <li key={t} style={{ marginBottom: '0.5mm' }}>{t}</li>
        ))}
      </ol>
    </div>
  );
}

export function DeclarationBlock() {
  return (
    <div style={{ fontSize: PRINT_FONT.size.xs, color: INK.muted, lineHeight: 1.5, fontStyle: 'italic' }}>
      We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
    </div>
  );
}

export function SignatureStrip({ companyName, layout = 'triple' }) {
  const sig = (label) => (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ borderTop: `1px solid ${INK.ruleDark}`, marginTop: '12mm', paddingTop: '1.5mm', fontSize: PRINT_FONT.size.xs, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );

  if (layout === 'dual') {
    return (
      <div className="ipe-avoid-break" style={{ display: 'flex', gap: '8mm', marginTop: '5mm' }}>
        {sig('Receiver\'s Signature')}
        {sig(`For ${companyName || 'Authorised Signatory'}`)}
      </div>
    );
  }

  return (
    <div className="ipe-avoid-break" style={{ display: 'flex', gap: '4mm', marginTop: '5mm' }}>
      {sig('Prepared By')}
      {sig('Checked By')}
      {sig(`For ${companyName || 'Authorised Signatory'}`)}
    </div>
  );
}

export function InvoiceFooter({ data, showBank = true, showTerms = true, showSignatures = true, bankLayout = 'horizontal' }) {
  const { company, bank, totals } = data;

  return (
    <div className="ipe-avoid-break" style={{ marginTop: '5mm', paddingTop: '3mm', borderTop: `1px solid ${INK.rule}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: showBank && showTerms ? '1fr 1fr' : '1fr', gap: '5mm' }}>
        {showBank ? <BankSection bank={bank} amount={totals?.grandTotal} layout={bankLayout === 'stacked' ? 'stacked' : 'horizontal'} /> : null}
        {showTerms ? (
          <div>
            <TermsSection data={data} />
            <div style={{ marginTop: '2mm' }}>
              <DeclarationBlock />
            </div>
          </div>
        ) : null}
      </div>
      {showSignatures ? <SignatureStrip companyName={company?.name} /> : null}
    </div>
  );
}
