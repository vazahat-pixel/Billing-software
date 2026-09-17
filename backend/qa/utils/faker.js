/**
 * Realistic textile demo names + structurally valid GSTINs (checksum).
 */
const STATES = [
  { name: 'Gujarat', code: '24', gstPrefix: '24', city: 'Surat' },
  { name: 'Maharashtra', code: '27', gstPrefix: '27', city: 'Mumbai' },
  { name: 'Rajasthan', code: '08', gstPrefix: '08', city: 'Bhilwara' },
  { name: 'Delhi', code: '07', gstPrefix: '07', city: 'New Delhi' },
];

const FABRICS = ['Cotton Grey', 'Polyester Grey', 'Rayon Print', 'Silk Blend', 'Linen Finish', 'Viscose Crepe'];
const COLORS = ['White', 'Navy', 'Maroon', 'Beige', 'Black', 'Gold', 'Teal', 'Ivory'];
const PROCESSES = ['Printing', 'Dyeing', 'Embroidery', 'Packing', 'Finishing'];

const SUPPLIER_NAMES = [
  'Shree Ambica Grey Mills',
  'Maheshwari Textiles',
  'Rajkot Cotton Traders',
  'Siyaram Grey House',
  'Vimal Yarn Agencies',
  'Surat Silk Emporium',
  'Bhilwara Fabric Hub',
  'Kohinoor Textile Corp',
];
const CUSTOMER_NAMES = [
  'Fashion Hub Retail',
  'Metro Garments Pvt Ltd',
  'StyleCraft Exports',
  'Urban Wear Distributors',
  'Linen Lounge Stores',
  'Prime Apparel Co',
  'Coastal Fashion House',
  'North India Outfitters',
];
const JOB_WORKER_NAMES = [
  'Om Dyeing & Printing',
  'Krishna Process Works',
  'Ankur Embroidery Mill',
  'Sunrise Finishing Unit',
  'Royal Packing Works',
];
const BROKER_NAMES = ['Patel Commission Agents', 'Shah Brokerage', 'Mehta Textile Brokers'];
const TRANSPORT_NAMES = ['VRL Logistics', 'Gati Transport'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function randFloat(min, max, decimals = 2) {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}

/** GSTIN check-digit (mod-36) over first 14 characters. */
function gstinChecksum(gstin14) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let factor = 1;
  let sum = 0;
  for (let i = gstin14.length - 1; i >= 0; i -= 1) {
    const codePoint = chars.indexOf(gstin14[i].toUpperCase());
    if (codePoint < 0) return 'Z';
    let product = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    product = Math.floor(product / chars.length) + (product % chars.length);
    sum += product;
  }
  const check = (chars.length - (sum % chars.length)) % chars.length;
  return chars[check];
}

function panFromSeq(seq) {
  // 5 letters + 4 digits + 1 letter — valid PAN shape
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = letters[(seq * 3) % 26];
  const b = letters[(seq * 5 + 1) % 26];
  const c = letters[(seq * 7 + 2) % 26];
  const d = letters[(seq * 11 + 3) % 26];
  const e = letters[(seq * 13 + 4) % 26];
  const digits = String(1000 + (seq % 9000)).slice(-4);
  const last = letters[(seq * 17) % 26];
  return `${a}${b}${c}${d}${e}${digits}${last}`;
}

function gstinForState(state, seq = 1) {
  const p = STATES.find((s) => s.name === state) || STATES[0];
  const pan = panFromSeq(seq);
  const body = `${p.gstPrefix}${pan}1Z`;
  return `${body}${gstinChecksum(body)}`;
}

function partyName(type, i) {
  const lists = {
    Supplier: SUPPLIER_NAMES,
    Customer: CUSTOMER_NAMES,
    'Job Worker': JOB_WORKER_NAMES,
    Broker: BROKER_NAMES,
    Transport: TRANSPORT_NAMES,
  };
  const list = lists[type];
  if (list && list[i - 1]) return list[i - 1];
  return `${type} ${String(i).padStart(2, '0')}`;
}

function itemName(category, i) {
  return `${category} ${pick(FABRICS)} ${pick(COLORS)} #${i}`;
}

function randomDateInFY(start = null, end = null) {
  const now = new Date();
  const monthStart = start || new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd = end && end < now ? end : now;
  const t = monthStart.getTime() + Math.random() * Math.max(1, rangeEnd.getTime() - monthStart.getTime());
  return new Date(t);
}

module.exports = {
  STATES,
  FABRICS,
  COLORS,
  PROCESSES,
  SUPPLIER_NAMES,
  CUSTOMER_NAMES,
  JOB_WORKER_NAMES,
  rand,
  pick,
  randFloat,
  gstinChecksum,
  panFromSeq,
  gstinForState,
  partyName,
  itemName,
  randomDateInFY,
};
