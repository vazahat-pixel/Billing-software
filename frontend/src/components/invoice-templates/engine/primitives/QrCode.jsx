import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** E-invoice / GST QR code */
export function InvoiceQr({ data, size = 72, label = 'Scan QR' }) {
  const [src, setSrc] = useState('');
  const { meta, company, totals } = data || {};

  useEffect(() => {
    let payload = '';
    if (meta?.irn) {
      payload = JSON.stringify({
        Irn: meta.irn,
        Gstin: company?.gstin,
        DocNo: meta.invoiceNo,
        DocDt: meta.date,
        TotInvVal: totals?.grandTotal,
      });
    } else if (company?.gstin) {
      payload = `GSTIN:${company.gstin}|INV:${meta?.invoiceNo || ''}|AMT:${totals?.grandTotal || 0}`;
    }

    if (!payload) {
      setSrc('');
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
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
  }, [meta?.irn, meta?.invoiceNo, meta?.date, company?.gstin, totals?.grandTotal, size]);

  if (!src) return null;

  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size, margin: '0 auto' }}
      />
      <div style={{ fontSize: '6.5pt', color: '#888', marginTop: 2, letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}

export { UpiQr } from '../../shared/BankBlock';
