/**
 * Pure presentation adapter — maps existing invoice + party + company into a
 * display view-model. Does NOT recalculate GST/totals; uses values as stored.
 */
import {
  resolveCompanyProfile,
  resolveParty,
  resolveItemName,
  fmtMoney,
  fmtNum,
  fmtDate,
  amountInWords,
} from '../../utils/invoiceHelpers';

const missing = (label) => ({ missing: true, label });

const resolveHsn = (line, items = []) => {
  if (line?.hsn) return line.hsn;
  if (line?.hsnCode) return line.hsnCode;
  if (typeof line?.itemId === 'object') {
    return line.itemId?.hsnCode || line.itemId?.hsn || '—';
  }
  const id = line?.itemId;
  const found = items.find((i) => String(i._id || i.id) === String(id));
  return found?.hsnCode || found?.hsn || '—';
};

const resolveUnit = (line) => line?.unit || line?.uom || (Number(line?.mts) ? 'Mtr' : 'Pcs');

const partyAddress = (p) => {
  if (!p) return '';
  return [p.address, p.city, p.state, p.pincode].filter(Boolean).join(', ');
};

/**
 * @returns {object} InvoiceViewModel for templates
 */
export function buildInvoiceViewModel({
  type = 'sale',
  invoice,
  parties = [],
  items = [],
  company,
  copyLabel = 'ORIGINAL',
  festival = null,
  showFestivalGreeting = false,
  showLogo = true,
} = {}) {
  if (!invoice) return null;

  const firm = resolveCompanyProfile(company);
  const isSale = type === 'sale';
  const partyRef = isSale ? invoice.customerId : invoice.supplierId;
  const party =
    resolveParty(partyRef, parties) ||
    (isSale
      ? { name: invoice.customerName || 'Cash Customer' }
      : { name: invoice.supplierName || 'Vendor' });

  const taxable = Number(invoice.taxableAmount ?? invoice.totals?.subtotal ?? 0);
  const gst = Number(invoice.gstAmount || 0);
  const net = Number(invoice.netAmount ?? invoice.totals?.total ?? taxable + gst);
  const isIgst = invoice.gstType === 'IGST' || /OUT OF STATE/i.test(invoice.type || '');
  const cgst = Number(invoice.cgst ?? (isIgst ? 0 : gst / 2));
  const sgst = Number(invoice.sgst ?? (isIgst ? 0 : gst / 2));
  const igst = Number(invoice.igst ?? (isIgst ? gst : 0));
  const discountTotal = Number(invoice.discountAmt || invoice.lessAmt || 0);
  const gstRate = Number(invoice.gstRate || 0);
  const halfRate = isIgst ? 0 : gstRate / 2;

  const lines = (Array.isArray(invoice.items) ? invoice.items : []).map((line, idx) => {
    const qty = Number(line.mts) || Number(line.pcs) || 0;
    const rate = Number(line.rate) || 0;
    const amount = Number(line.amount) || qty * rate;
    const lineDiscount = Number(line.discount || line.dis1Amt || 0);
    const taxableLine = amount - lineDiscount;
    const lineGst = gstRate ? (taxableLine * gstRate) / 100 : 0;
    return {
      sno: idx + 1,
      name: resolveItemName(line, items),
      desc: line.desc || '',
      hsn: resolveHsn(line, items),
      qty,
      pcs: Number(line.pcs) || 0,
      mts: Number(line.mts) || 0,
      fold: line.fold ?? '',
      cut: line.cut ?? '',
      unit: resolveUnit(line),
      rate,
      discount: lineDiscount,
      taxable: taxableLine,
      cgstPct: isIgst ? 0 : halfRate,
      sgstPct: isIgst ? 0 : halfRate,
      igstPct: isIgst ? gstRate : 0,
      cgstAmt: isIgst ? 0 : lineGst / 2,
      sgstAmt: isIgst ? 0 : lineGst / 2,
      igstAmt: isIgst ? lineGst : 0,
      total: taxableLine + lineGst,
      amount,
    };
  });

  const warnings = [];
  if (!firm.gstin) warnings.push('Add Company GSTIN in Company Settings');
  if (!firm.name || firm.name === 'Company') warnings.push('Set Business Legal Name in Company Settings');
  if (!party?.name) warnings.push('Bill-To party name is missing on this invoice');
  if (!firm.bankName && !firm.accountNo) warnings.push('Optional: add bank details for the invoice footer');
  if (showLogo && !firm.logoUrl) warnings.push('Optional: add logo URL for letterhead');

  const shipTo =
    invoice.shipToName || invoice.shippingAddress
      ? {
          name: invoice.shipToName || party?.name,
          gstin: invoice.shipToGstin || party?.gstin,
          address: invoice.shippingAddress || partyAddress(party),
          state: invoice.shipToState || party?.state,
          stateCode: invoice.shipToStateCode || party?.stateCode,
          phone: invoice.shipToPhone || party?.mobile || party?.phone || '',
          email: invoice.shipToEmail || party?.email || '',
        }
      : null;

  const billToSameAsShip =
    !shipTo ||
    (shipTo.name === party?.name &&
      (shipTo.address || '') === (partyAddress(party) || ''));

  return {
    type,
    isSale,
    docTitle: isSale ? 'TAX INVOICE' : 'PURCHASE VOUCHER',
    copyLabel: String(copyLabel || 'ORIGINAL').toUpperCase(),
    meta: {
      invoiceNo: invoice.invoiceNo || '—',
      date: fmtDate(invoice.date || invoice.createdAt),
      dueDate: invoice.dueDate ? fmtDate(invoice.dueDate) : null,
      dueDays: invoice.dueDays || null,
      paymentTerms: invoice.paymentTerms || (invoice.dueDays ? `${invoice.dueDays} days` : null),
      placeOfSupply: party?.state || firm.state || '—',
      placeOfSupplyCode: party?.stateCode || firm.stateCode || '',
      reverseCharge: invoice.reverseCharge ? 'Y' : 'N',
      invoiceType: invoice.invoiceType || 'Tax',
      orderNo: invoice.orderNo || '',
      orderDate: invoice.orderDate ? fmtDate(invoice.orderDate) : '',
      challanNo: invoice.challanNo || '',
      transport: invoice.transport || '',
      lrNo: invoice.lrNo || '',
      station: invoice.station || '',
      eway: invoice.eway || '',
      broker: invoice.brokerName || '',
      haste: invoice.haste || '',
      remarks: invoice.remarks || invoice.narration || '',
      supplierInvoiceNo: invoice.supplierInvoiceNo || '',
      irn: invoice.irn || invoice.einvoice?.irn || '',
      ackNo: invoice.ackNo || invoice.einvoice?.ackNo || '',
      ackDate: invoice.ackDate
        ? fmtDate(invoice.ackDate)
        : invoice.einvoice?.ackDate
          ? fmtDate(invoice.einvoice.ackDate)
          : '',
    },
    company: {
      ...firm,
      showLogo: showLogo !== false,
      logoMissing: showLogo && !firm.logoUrl,
    },
    billTo: {
      name: party?.name || '—',
      gstin: party?.gstin || '',
      address: partyAddress(party),
      state: party?.state || '',
      stateCode: party?.stateCode || party?.stateName || '',
      phone: party?.mobile || party?.phone || party?.phoneO || '',
      email: party?.email || '',
      pan: party?.pan || '',
    },
    shipTo: billToSameAsShip ? null : shipTo,
    lines,
    isIgst,
    gstRate,
    totals: {
      subtotal: taxable + discountTotal,
      discount: discountTotal,
      taxable,
      cgst,
      sgst,
      igst,
      gst,
      tcs: Number(invoice.tcs || invoice.tcsAmount || 0),
      tcsPer: invoice.tcsPer || 0,
      roundOff: Number(invoice.roundOff || 0),
      grandTotal: net,
      amountWords: amountInWords(net),
    },
    bank: {
      accountName: firm.accountName || firm.name,
      bankName: firm.bankName || '',
      accountNo: firm.accountNo || '',
      ifsc: firm.ifsc || '',
      branch: firm.bankBranch || '',
      upiId: firm.upiId || '',
    },
    terms:
      firm.invoiceTerms ||
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    festival,
    showFestivalGreeting: !!(showFestivalGreeting && festival?.greeting),
    warnings,
    fmt: { money: fmtMoney, num: fmtNum, date: fmtDate },
    _raw: { invoice, party, firm },
  };
}

export { missing };
