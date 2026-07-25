/**
 * Resolves invoice/print letterhead from live session config — never a demo firm.
 */
import useConfigStore from '../store/useConfigStore';
import { stateCodeFromGstin } from './gstStateCodes';

/** @deprecated Prefer resolveCompanyProfile() — kept so old imports don't crash */
export const DEMO_COMPANY = null;

const PLACEHOLDER_NAME = /^(company|my company|your company name)$/i;

const isPlaceholderName = (v) => PLACEHOLDER_NAME.test(String(v || '').trim());

/** Prefer first non-empty, non-placeholder value */
const pick = (...vals) => {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s && !isPlaceholderName(s)) return s;
  }
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
};

/**
 * Always merges Company Settings from the live config store.
 * A partial `override` must not wipe saved GSTIN / bank / legal name.
 */
export const resolveCompanyProfile = (override) => {
  const cfg = useConfigStore.getState();
  const settings = cfg.companySettings || {};
  const company = cfg.company || {};
  const meta = company.meta || {};
  const o = override && typeof override === 'object' ? override : {};

  const name = pick(
    settings.legalName,
    settings.shortName,
    o.legalName,
    o.name,
    company.name
  );

  const gstin = pick(settings.gstin, meta.gstin, o.gstin);
  const stateCode = pick(
    settings.stateCode,
    meta.stateCode,
    o.stateCode,
    stateCodeFromGstin(gstin)
  );

  return normalizeCompany({
    name: name || 'Company',
    tagline: pick(settings.tagline, settings.businessType, o.tagline),
    address: pick(settings.address, meta.address, o.address),
    area: [
      pick(settings.city, meta.city, o.city),
      pick(settings.state, meta.state, o.state),
      pick(settings.pincode, meta.pincode, o.pincode),
    ]
      .filter(Boolean)
      .join(', '),
    phone: pick(settings.phone, meta.phone, o.phone),
    email: pick(settings.email, meta.email, o.email),
    website: pick(settings.website, o.website),
    gstin,
    pan: pick(settings.pan, meta.pan, o.pan),
    bankName: pick(settings.bankName, settings.bank?.name, o.bankName),
    accountName: pick(
      settings.accountName,
      settings.bank?.accountName,
      settings.legalName,
      o.accountName,
      name
    ),
    accountNo: pick(settings.accountNo, settings.bank?.accountNo, o.accountNo),
    ifsc: pick(settings.ifsc, settings.bank?.ifsc, o.ifsc),
    bankBranch: pick(settings.bankBranch, settings.bank?.branch, o.bankBranch),
    upiId: pick(settings.upiId, settings.upi, o.upiId),
    invoiceTerms: pick(settings.invoiceTerms, settings.terms, o.invoiceTerms),
    logoUrl: pick(settings.logoUrl, o.logoUrl),
    showLogo: settings.showLogo !== false && o.showLogo !== false,
    state: pick(settings.state, meta.state, o.state),
    stateCode,
    autoFestiveTheme: settings.autoFestiveTheme === true,
    showFestivalGreeting: !!settings.showFestivalGreeting,
    invoiceTemplateId: settings.invoiceTemplateId || o.invoiceTemplateId || 'gst-formal',
  });
};

function normalizeCompany(c) {
  const gstin = String(c.gstin || '').replace(/\s/g, '').toUpperCase();
  const rawName = String(c.name || c.legalName || '').trim();
  return {
    name: isPlaceholderName(rawName) ? '' : rawName || '',
    tagline: c.tagline || '',
    address: c.address || '',
    area: c.area || '',
    phone: c.phone || '',
    email: c.email || '',
    website: c.website || '',
    gstin,
    pan: c.pan || '',
    bankName: c.bankName || '',
    accountName: c.accountName || '',
    accountNo: c.accountNo || '',
    ifsc: c.ifsc || '',
    bankBranch: c.bankBranch || '',
    upiId: c.upiId || '',
    invoiceTerms: c.invoiceTerms || '',
    logoUrl: c.logoUrl || '',
    showLogo: c.showLogo !== false,
    state: c.state || '',
    stateCode: c.stateCode || stateCodeFromGstin(gstin) || '',
    autoFestiveTheme: c.autoFestiveTheme === true,
    showFestivalGreeting: !!c.showFestivalGreeting,
    invoiceTemplateId: c.invoiceTemplateId || 'gst-formal',
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
  return found?.name || found?.itemName || '—';
};

export const buildWhatsAppMessage = ({ type, invoice, party, company }) => {
  const firm = resolveCompanyProfile(company);
  const invNo = invoice?.invoiceNo || invoice?.billNo || '—';
  const amt = fmtMoney(invoice?.netAmount || invoice?.totalAmount || 0);
  const partyName = party?.name || 'Customer';
  const firmLabel = firm.name || 'Company';
  return `*${firmLabel}*\n${type || 'Invoice'} ${invNo}\nParty: ${partyName}\nAmount: ${amt}\nGSTIN: ${firm.gstin || '—'}`;
};

export const openWhatsAppShare = (message, phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(message || '');
  const url = digits
    ? `https://wa.me/${digits.startsWith('91') ? digits : `91${digits}`}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};
