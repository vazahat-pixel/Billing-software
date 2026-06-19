const TYPE_TO_GROUP = {
  Customer: 'SUNDRY DEBTORS',
  Supplier: 'SUNDRY CREDITORS',
  Broker: 'BROKER',
  'Job Worker': 'JOB WORKER',
  Both: 'SUNDRY DEBTORS'
};

export const normalizeParty = (party) => {
  if (!party) return party;
  const id = party._id || party.id;
  const type = party.type || 'Customer';
  return {
    ...party,
    _id: id,
    id,
    station: party.station || party.city || '',
    city: party.city || party.station || '',
    group: party.group || TYPE_TO_GROUP[type] || 'SUNDRY DEBTORS',
    type,
    openingBalance: party.openingBalance ?? 0,
    openingBalanceType: party.openingBalanceType || 'Dr'
  };
};

export const normalizeItem = (item) => {
  if (!item) return item;
  const id = item._id || item.id;
  return {
    ...item,
    _id: id,
    id,
    itemName: item.itemName || item.name || '',
    name: item.name || item.itemName || '',
    salesRate: item.salesRate ?? item.saleRate ?? 0,
    purchaseRate: item.purchaseRate ?? item.purRate ?? 0,
    purRate: item.purRate ?? item.purchaseRate ?? 0
  };
};

export const normalizeSale = (sale) => {
  if (!sale) return sale;
  const id = sale._id || sale.id;
  const taxable = sale.taxableAmount ?? sale.totals?.subtotal ?? sale.totals?.taxableValue ?? 0;
  const gst = sale.gstAmount ?? 0;
  const net = sale.netAmount ?? sale.totals?.total ?? taxable + gst;
  const halfGst = gst / 2;
  return {
    ...sale,
    _id: id,
    id,
    status: sale.status || 'active',
    totals: sale.totals || {
      subtotal: taxable,
      taxableValue: taxable,
      cgst: halfGst,
      sgst: halfGst,
      igst: gst,
      total: net
    }
  };
};

export const normalizePurchase = (purchase) => {
  if (!purchase) return purchase;
  const id = purchase._id || purchase.id;
  const taxable = purchase.taxableAmount ?? purchase.totals?.subtotal ?? purchase.totals?.taxableValue ?? 0;
  const gst = purchase.gstAmount ?? 0;
  const net = purchase.netAmount ?? purchase.totals?.total ?? taxable + gst;
  const halfGst = gst / 2;
  return {
    ...purchase,
    _id: id,
    id,
    status: purchase.status || 'active',
    totals: purchase.totals || {
      subtotal: taxable,
      taxableValue: taxable,
      cgst: halfGst,
      sgst: halfGst,
      igst: gst,
      total: net
    }
  };
};

export const normalizeUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    id: user._id || user.id,
    companyRole: user.companyRole || 'owner',
    companyName: user.companyName || user.company?.name || user.settings?.legalName || ''
  };
};
