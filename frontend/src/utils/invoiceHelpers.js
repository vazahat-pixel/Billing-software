/**
 * Resolves invoice/print letterhead from live session config — never a demo firm.
 */
import useConfigStore from '../store/useConfigStore';

/** @deprecated Prefer resolveCompanyProfile() — kept so old imports don't crash */
export const DEMO_COMPANY = null;

export const resolveCompanyProfile = (override) => {
  if (override && (override.name || override.legalName || override.gstin)) {
    return normalizeCompany(override);
  }
  const cfg = useConfigStore.getState();
  const settings = cfg.companySettings || {};
  const company = cfg.company || {};
  const meta = company.meta || {};
  return normalizeCompany({
    name: settings.legalName || settings.shortName || company.name || 'Company',
    tagline: settings.tagline || settings.businessType || '',
    address: settings.address || meta.address || '',
    area: [settings.city || meta.city, settings.state || meta.state, settings.pincode || meta.pincode]
      .filter(Boolean)
      .join(', '),
    phone: settings.phone || meta.phone || '',
    email: settings.email || meta.email || '',
    gstin: settings.gstin || meta.gstin || '',
    pan: settings.pan || meta.pan || '',
    bankName: settings.bankName || settings.bank?.name || '',
    accountNo: settings.accountNo || settings.bank?.accountNo || '',
    ifsc: settings.ifsc || settings.bank?.ifsc || '',
    state: settings.state || meta.state || '',
    stateCode: settings.stateCode || meta.stateCode || '',
  });
};

function normalizeCompany(c) {
  return {
    name: c.name || c.legalName || 'Company',
    tagline: c.tagline || '',
    address: c.address || '',
    area: c.area || '',
    phone: c.phone || '',
    email: c.email || '',
    gstin: c.gstin || '',
    pan: c.pan || '',
    bankName: c.bankName || '',
    accountNo: c.accountNo || '',
    ifsc: c.ifsc || '',
    state: c.state || '',
    stateCode: c.stateCode || '',
  };
}

export const fmtMoney = (n) =>
  `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtNum = (n) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  if (!d) return '—';
  const raw = String(d).includes('T') ? d.split('T')[0] : d;
  try {
    return new Date(raw).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return raw;
  }
};

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim();
};

export const amountInWords = (amount) => {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees Only';
  let n = num;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;
  const parts = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return `Indian Rupees ${parts.join(' ')} Only`;
};

export const resolveParty = (ref, parties = []) => {
  if (!ref) return null;
  if (typeof ref === 'object' && (ref.name || ref.gstin)) return ref;
  const id = typeof ref === 'object' ? ref._id || ref.id : ref;
  return parties.find((p) => String(p._id || p.id) === String(id)) || null;
};

export const resolveItemName = (line, items = []) => {
  if (line?.itemName) return line.itemName;
  if (typeof line?.itemId === 'object') {
    return line.itemId?.name || '—';
  }
  const id = line?.itemId;
  const found = items.find((i) => String(i._id || i.id) === String(id));
  return found?.name || '—';
};

export const buildWhatsAppMessage = ({ type, invoice, party, company }) => {
  const firm = resolveCompanyProfile(company);
  const invNo = invoice?.invoiceNo || invoice?.billNo || '—';
  const amt = fmtMoney(invoice?.netAmount || invoice?.totalAmount || 0);
  const partyName = party?.name || 'Customer';
  return `*${firm.name}*\n${type || 'Invoice'} ${invNo}\nParty: ${partyName}\nAmount: ${amt}\nGSTIN: ${firm.gstin || '—'}`;
};

export const openWhatsAppShare = (message, phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(message || '');
  const url = digits
    ? `https://wa.me/${digits.startsWith('91') ? digits : `91${digits}`}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};
