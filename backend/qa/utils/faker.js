const STATES = [
  { name: 'Gujarat', code: '24', gstPrefix: '24' },
  { name: 'Maharashtra', code: '27', gstPrefix: '27' },
  { name: 'Rajasthan', code: '08', gstPrefix: '08' },
  { name: 'Delhi', code: '07', gstPrefix: '07' },
];

const FABRICS = ['Cotton Grey', 'Polyester Grey', 'Rayon Print', 'Silk Blend', 'Linen Finish'];
const COLORS = ['White', 'Navy', 'Maroon', 'Beige', 'Black', 'Gold', 'Teal'];
const PROCESSES = ['Printing', 'Dyeing', 'Embroidery', 'Packing'];

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

function gstinForState(state, seq = 1) {
  const p = STATES.find((s) => s.name === state) || STATES[0];
  const pan = `AAAAA${String(seq).padStart(4, '0')}A`;
  return `${p.gstPrefix}${pan}1Z5`;
}

function partyName(type, i) {
  return `QA ${type} ${String(i).padStart(3, '0')}`;
}

function itemName(category, i) {
  return `QA ${category} ${pick(FABRICS)} ${pick(COLORS)} ${i}`;
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
  rand,
  pick,
  randFloat,
  gstinForState,
  partyName,
  itemName,
  randomDateInFY,
};
