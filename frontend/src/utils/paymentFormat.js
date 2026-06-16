const MODE_LABELS = {
  Cash: 'Cash',
  Card: 'Card',
  Cheque: 'Cheque',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  UPI: 'UPI',
  Mixed: 'Mixed'
};

export const formatPaymentSplits = (voucher) => {
  if (!voucher) return '—';

  const splits = (voucher.paymentSplits || []).filter(s => (s.amount || 0) > 0);
  if (splits.length > 0) {
    return splits
      .map(s => {
        const ref = s.reference ? ` (${s.reference})` : '';
        return `${MODE_LABELS[s.mode] || s.mode} ₹${Number(s.amount).toLocaleString('en-IN')}${ref}`;
      })
      .join(' + ');
  }

  if (voucher.paymentMode && voucher.paymentMode !== 'Mixed') {
    const ref = voucher.utrNo || voucher.chequeNo;
    const refStr = ref ? ` (${ref})` : '';
    return `${MODE_LABELS[voucher.paymentMode] || voucher.paymentMode}${refStr}`;
  }

  return voucher.paymentMode || '—';
};

export const getPaymentSplits = (voucher) => {
  const splits = (voucher?.paymentSplits || []).filter(s => (s.amount || 0) > 0);
  if (splits.length > 0) return splits;
  if (voucher?.paymentMode && voucher?.amount) {
    return [{
      mode: voucher.paymentMode,
      amount: voucher.amount,
      reference: voucher.utrNo || voucher.chequeNo || ''
    }];
  }
  return [];
};

export const PAYMENT_MODE_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card / Debit / Credit' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' }
];

export const buildSplitsPayload = (splits) =>
  splits
    .filter(s => parseFloat(s.amount) > 0)
    .map(s => ({
      mode: s.mode,
      amount: parseFloat(parseFloat(s.amount).toFixed(2)),
      reference: s.reference?.trim() || undefined
    }));
