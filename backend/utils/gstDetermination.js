/**
 * GSTIN / place-of-supply determination — Sprint 4.2
 * Never hardcode state; derive from GSTIN first 2 digits or configured stateCode.
 */

const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh', '97': 'Other Territory',
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function normalizeGstin(gstin) {
  return String(gstin || '').trim().toUpperCase();
}

function validateGstin(gstin) {
  const g = normalizeGstin(gstin);
  if (!g) return { ok: false, reason: 'GSTIN empty' };
  if (g.length !== 15) return { ok: false, reason: 'GSTIN must be 15 characters' };
  if (!GSTIN_REGEX.test(g)) return { ok: false, reason: 'GSTIN format invalid' };
  return { ok: true, gstin: g, stateCode: g.substring(0, 2) };
}

function stateCodeFromGstin(gstin) {
  const g = normalizeGstin(gstin);
  if (g.length >= 2) return g.substring(0, 2);
  return '';
}

function stateNameFromCode(code) {
  return STATE_CODES[code] || '';
}

/**
 * Determine CGST+SGST vs IGST from supplier/company vs party GSTIN/state.
 */
function determineGstType({ companyGstin, companyStateCode, partyGstin, partyStateCode, forceType }) {
  if (forceType === 'IGST' || forceType === 'CGST+SGST') return forceType;

  const companyCode = companyStateCode || stateCodeFromGstin(companyGstin);
  const partyCode = stateCodeFromGstin(partyGstin) || partyStateCode || '';

  if (!companyCode || !partyCode) {
    // Default intra-state when unknown — caller may override
    return 'CGST+SGST';
  }
  return companyCode === partyCode ? 'CGST+SGST' : 'IGST';
}

function placeOfSupply({ partyGstin, partyStateCode, companyStateCode }) {
  const code = stateCodeFromGstin(partyGstin) || partyStateCode || companyStateCode || '';
  return {
    stateCode: code,
    stateName: stateNameFromCode(code),
  };
}

/**
 * Compute tax components from taxable + rate + type.
 */
function computeTaxComponents(taxableAmount, gstRate, gstType, cessRate = 0) {
  const taxable = Number(Number(taxableAmount || 0).toFixed(2));
  const rate = Number(gstRate || 0);
  const cessR = Number(cessRate || 0);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;

  if (gstType === 'IGST' || gstType === 'ZeroRated' || gstType === 'Export') {
    igst = Number(((taxable * rate) / 100).toFixed(2));
  } else if (gstType === 'Exempt' || gstType === 'NilRated' || gstType === 'NonGST') {
    // zero
  } else {
    const total = Number(((taxable * rate) / 100).toFixed(2));
    cgst = Number((total / 2).toFixed(2));
    sgst = Number((total - cgst).toFixed(2));
  }
  if (cessR > 0) {
    cess = Number(((taxable * cessR) / 100).toFixed(2));
  }

  const gstAmount = Number((cgst + sgst + igst).toFixed(2));
  return { taxableAmount: taxable, cgst, sgst, igst, cess, gstAmount, gstType, gstRate: rate };
}

function periodKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodBounds(period) {
  // period: YYYY-MM
  const [y, m] = period.split('-').map(Number);
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0, 23, 59, 59, 999);
  return { startDate, endDate, financialYear: m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}` };
}

function filingPeriodFp(period) {
  // GST portal fp: MMYYYY
  const [y, m] = period.split('-');
  return `${m}${y}`;
}

module.exports = {
  STATE_CODES,
  GSTIN_REGEX,
  normalizeGstin,
  validateGstin,
  stateCodeFromGstin,
  stateNameFromCode,
  determineGstType,
  placeOfSupply,
  computeTaxComponents,
  periodKey,
  periodBounds,
  filingPeriodFp,
};
