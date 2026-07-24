/** Indian GST state codes (first 2 digits of GSTIN). */
export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

/** Normalize to 2-digit GST code, e.g. "23", "3" → "03". */
export function normalizeGstStateCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-2).padStart(2, '0');
}

export function stateNameFromCode(raw) {
  const code = normalizeGstStateCode(raw);
  if (!code || code === '00') return '';
  return GST_STATE_CODES[code] || '';
}

/** First 2 digits of GSTIN = state code. */
export function stateCodeFromGstin(gstin) {
  const g = String(gstin || '').replace(/\s/g, '').toUpperCase();
  if (g.length < 2) return '';
  return normalizeGstStateCode(g.slice(0, 2));
}

/**
 * Auto IN STATE vs OUT OF STATE from party vs company location.
 * Prefers GSTIN prefix; falls back to explicit stateCode fields.
 */
export function resolveInvoiceSupplyType({ partyGstin, partyStateCode, companyGstin, companyStateCode }) {
  const party =
    stateCodeFromGstin(partyGstin) || normalizeGstStateCode(partyStateCode);
  const company =
    stateCodeFromGstin(companyGstin) || normalizeGstStateCode(companyStateCode);
  if (!party || !company) return null; // unknown — keep manual
  return party === company ? 'INVOICE IN STATE' : 'INVOICE OUT OF STATE';
}
