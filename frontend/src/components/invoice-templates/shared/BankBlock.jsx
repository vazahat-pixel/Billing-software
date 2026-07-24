import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** UPI QR from existing upiId — pure display */
export function UpiQr({ upiId, payeeName, amount, size = 88 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!upiId) {
      setSrc('');
      return;
    }
    const params = new URLSearchParams({
      pa: upiId,
      pn: payeeName || 'Merchant',
      cu: 'INR',
    });
    if (amount && Number(amount) > 0) params.set('am', Number(amount).toFixed(2));
    const uri = `upi://pay?${params.toString()}`;
    let cancelled = false;
    QRCode.toDataURL(uri, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [upiId, payeeName, amount, size]);

  if (!upiId) return null;
  if (!src) {
    return (
      <div style={{ width: size, height: size, border: '1px dashed #cbd5e1', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        QR…
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="UPI QR"
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size }}
    />
  );
}

export function BankBlock({ bank, amount, accent = '#0f172a', compact = false }) {
  const hasBank = !!(bank?.bankName || bank?.accountNo || bank?.ifsc);
  return (
    <div style={{ fontSize: compact ? 8 : 9, color: '#475569', lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800, color: accent, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 8 }}>
        Bank Details
      </div>
      {hasBank ? (
        <>
          <div>{bank.accountName}</div>
          <div>{bank.bankName}{bank.branch ? ` · ${bank.branch}` : ''}</div>
          <div>A/c: {bank.accountNo || '—'} · IFSC: {bank.ifsc || '—'}</div>
        </>
      ) : (
        <div style={{ color: '#94a3b8' }}>Bank details not set</div>
      )}
      {bank?.upiId && (
        <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <UpiQr upiId={bank.upiId} payeeName={bank.accountName} amount={amount} size={compact ? 64 : 80} />
          <div>
            <div style={{ fontWeight: 700, color: accent }}>UPI</div>
            <div>{bank.upiId}</div>
          </div>
        </div>
      )}
    </div>
  );
}
