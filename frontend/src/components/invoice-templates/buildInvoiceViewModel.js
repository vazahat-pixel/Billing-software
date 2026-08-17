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

const printTimestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const resolveLot = (line, items = []) => {
  if (line?.lot) return String(line.lot);
  if (line?.lotId && typeof line.lotId === 'object') {
    return line.lotId?.lotNo || line.lotId?.name || line.lotId?.code || '';
  }
  if (line?.lotId) {
    const found = items.find((i) => String(i._id || i.id) === String(line.lotId));
    return found?.lotNo || found?.name || String(line.lotId);
  }
  return '';
};

const missing = (label) => ({ missing: true, label });

const resolveHsn = (line, items = []) => {
  if (line?.hsn) return line.hsn;
  if (line?.hsnCode) return line.hsnCode;
  if (typeof line?.itemId === 'object') {
    return line.itemId?.hsnCode || line.itemId?.hsn || '';
  }
  const id = line?.itemId;
  const found = items.find((i) => String(i._id || i.id) === String(id));
  return found?.hsnCode || found?.hsn || '';
};

const resolveUnit = (line) => line?.unit || line?.uom || (Number(line?.mts) ? 'MTRS' : 'PCS');

const partyAddress = (p) => {
  if (!p) return '';
  return [p.address, p.city, p.state, p.pincode].filter(Boolean).join(', ');
};

const partyAddressLines = (p) => {
  if (!p) return [];
  const lines = [];
  if (p.address) lines.push(String(p.address));
  const cityLine = [p.city, p.pincode].filter(Boolean).join(' - ');
  if (cityLine) lines.push(cityLine);
  else if (p.state && !String(p.address || '').includes(String(p.state))) lines.push(String(p.state));
  return lines;
};

/** True only for real calendar dates (rejects bare day numbers like "4"). */
const isValidPrintDate = (d) => {
  if (d == null || d === '') return false;
  if (typeof d === 'number' && d < 100000) return false;
  const s = String(d).trim();
  if (/^\d{1,2}$/.test(s)) return false;
  const raw = s.includes('T') ? s.split('T')[0] : s;
  const dt = new Date(raw);
  return !Number.isNaN(dt.getTime()) && dt.getFullYear() >= 1990;
};

/** DD-MM-YYYY — textile ERP print style */
const fmtDateDMY = (d) => {
  if (!isValidPrintDate(d)) return '';
  const raw = String(d).includes('T') ? String(d).split('T')[0] : d;
  const dt = new Date(raw);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const resolveDueDatePrint = (invoice) => {
  if (isValidPrintDate(invoice.dueDate)) return fmtDateDMY(invoice.dueDate);
  const days = Number(invoice.dueDays || 0);
  if (days > 0 && isValidPrintDate(invoice.date)) {
    const base = new Date(invoice.date);
    base.setDate(base.getDate() + days);
    return fmtDateDMY(base);
  }
  return '';
};

/** GSTIN must be 15 chars — never show state-code "09" as GSTIN */
const normalizeGstin = (g) => {
  const s = String(g || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (s.length >= 15) return s;
  return '';
};

const stateCodeFromGstin = (g) => {
  const s = String(g || '').trim();
  if (/^\d{2}/.test(s)) return s.slice(0, 2);
  return '';
};

const stateLabel = (state, code) => {
  const s = String(state || '').trim();
  const c = String(code || '').trim();
  if (c && s) return `${c.padStart(2, '0')}-${s.toUpperCase()}`;
  if (c) return c.padStart(2, '0');
  return s ? s.toUpperCase() : '';
};

const DEFAULT_TERMS = [
  'Claim if any must be made within 24 hours of receipt of goods.',
  "Interest @24% will be charged if payment is not made within due date.",
  "Subject to 'SURAT' Jurisdiction.",
  'Goods once sold will not be taken back.',
  'Our responsibility ceases as soon as the goods leave our premises.',
];

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

  const broker =
    resolveParty(invoice.brokerId, parties) ||
    (invoice.brokerName ? { name: invoice.brokerName } : null);

  const taxable = Number(invoice.taxableAmount ?? invoice.totals?.subtotal ?? 0);
  const gst = Number(invoice.gstAmount || 0);
  const net = Number(invoice.netAmount ?? invoice.totals?.total ?? taxable + gst);
  const isIgst = invoice.gstType === 'IGST' || /OUT OF STATE/i.test(invoice.type || '');
  const cgst = Number(invoice.cgst ?? (isIgst ? 0 : gst / 2));
  const sgst = Number(invoice.sgst ?? (isIgst ? 0 : gst / 2));
  const igst = Number(invoice.igst ?? (isIgst ? gst : 0));
  const cess = Number(invoice.cess || 0);
  // Separate discount and less so templates can render them as distinct labelled rows
  const discountAmt = Number(invoice.discountAmt || 0);
  const footerLess = Number(invoice.lessAmt || 0);
  const footerAdd = Number(invoice.addAmt || 0);
  const discountTotal = discountAmt + footerLess;
  // Compute gross base (before deductions) so we can derive percentages for display
  const grossBase = taxable + discountTotal + Number(invoice.foldLess || 0);
  const discountPer = grossBase > 0 && discountAmt > 0
    ? Math.round((discountAmt / grossBase) * 10000) / 100
    : Number(invoice.discountPer || 0);
  const lessPer = grossBase > 0 && footerLess > 0
    ? Math.round((footerLess / (grossBase - discountAmt)) * 10000) / 100
    : Number(invoice.lessPer || 0);

  // Prefer line gstPer; else bill gstRate; else derive from taxable
  let gstRate = Number(invoice.gstRate || 0);
  if (!gstRate && taxable > 0 && gst > 0) {
    gstRate = Math.round((gst / taxable) * 10000) / 100;
  }
  const halfRate = isIgst ? 0 : gstRate / 2;

  const lines = (Array.isArray(invoice.items) ? invoice.items : []).map((line, idx) => {
    const pcs = Number(line.pcs) || 0;
    const mts = Number(line.mts) || 0;
    const rate = Number(line.rate) || 0;
    const amount = Number(line.amount) || (mts || pcs) * rate;
    const dis1Amt = Number(line.dis1Amt || 0);
    const dis2Amt = Number(line.dis2Amt || 0);
    const addAmt = Number(line.addAmt || 0);
    const legacyDisc = Number(line.discount || 0);
    const lineDiscount = dis1Amt + dis2Amt || legacyDisc;
    // Match salesBillCalc.lineTaxable
    const taxableLine = amount - dis1Amt - dis2Amt + addAmt - (dis1Amt || dis2Amt ? 0 : legacyDisc);
    const lineGstPer = Number(line.gstPer || gstRate || 0);
    const lineGst = Number(line.gstAmt) || (lineGstPer ? (taxableLine * lineGstPer) / 100 : 0);
    const lineHalf = isIgst ? 0 : lineGstPer / 2;
    return {
      sno: idx + 1,
      name: resolveItemName(line, items),
      desc: line.desc || '',
      hsn: resolveHsn(line, items),
      qty: mts || pcs,
      pcs,
      mts,
      fold: line.fold ?? '',
      cut: line.cut ?? '',
      lot: resolveLot(line, items),
      batch: line.batch || line.batchNo || '',
      weight: Number(line.weight || line.kgs || 0) || null,
      remarks: line.remark || line.remarks || '',
      designNo: line.designNo || line.design || '',
      colour: line.colour || line.color || '',
      quality: line.quality || '',
      grey: line.grey || '',
      finish: line.finish || '',
      bale: line.bale || line.baleNo || '',
      roll: line.roll || line.rollNo || '',
      fabricWidth: line.fabricWidth || line.width || '',
      unit: resolveUnit(line),
      rate,
      discount: lineDiscount,
      dis1Per: Number(line.dis1Per || 0),
      dis1Amt,
      dis2Per: Number(line.dis2Per || 0),
      dis2Amt,
      addAmt,
      gstPer: lineGstPer,
      gstAmt: lineGst,
      taxable: taxableLine,
      cgstPct: isIgst ? 0 : lineHalf,
      sgstPct: isIgst ? 0 : lineHalf,
      igstPct: isIgst ? lineGstPer : 0,
      cgstAmt: isIgst ? 0 : lineGst / 2,
      sgstAmt: isIgst ? 0 : lineGst / 2,
      igstAmt: isIgst ? lineGst : 0,
      total: taxableLine + lineGst,
      amount,
      pcsDetails: Array.isArray(line.pcsDetails) ? line.pcsDetails : [],
    };
  });

  const totalPcs = lines.reduce((s, l) => s + (Number(l.pcs) || 0), 0);
  const totalMts = lines.reduce((s, l) => s + (Number(l.mts) || 0), 0);
  const totalLineAmount = lines.reduce((s, l) => s + (Number(l.taxable) || Number(l.amount) || 0), 0);

  // Tax summary rows grouped by gst %
  const taxGroups = {};
  lines.forEach((l) => {
    const pct = Number(l.gstPer || gstRate || 0);
    const key = String(pct);
    if (!taxGroups[key]) {
      taxGroups[key] = {
        taxPct: pct,
        taxValue: 0,
        cgstPct: isIgst ? 0 : pct / 2,
        cgstAmt: 0,
        sgstPct: isIgst ? 0 : pct / 2,
        sgstAmt: 0,
        igstPct: isIgst ? pct : 0,
        igstAmt: 0,
        cessPct: 0,
        cessAmt: 0,
        total: 0,
      };
    }
    const g = taxGroups[key];
    const tv = Number(l.taxable) || 0;
    g.taxValue += tv;
    g.cgstAmt += Number(l.cgstAmt) || 0;
    g.sgstAmt += Number(l.sgstAmt) || 0;
    g.igstAmt += Number(l.igstAmt) || 0;
    g.total += tv + (Number(l.gstAmt) || 0);
  });
  let taxRows = Object.values(taxGroups);
  const taxRowsGst = taxRows.reduce(
    (s, r) => s + Number(r.cgstAmt || 0) + Number(r.sgstAmt || 0) + Number(r.igstAmt || 0),
    0
  );
  // Prefer bill-level GST when line tax amounts drift (e.g. 1.50 vs 879.85)
  const billTaxRow = {
    taxPct: gstRate,
    taxValue: taxable,
    cgstPct: isIgst ? 0 : halfRate,
    cgstAmt: cgst,
    sgstPct: isIgst ? 0 : halfRate,
    sgstAmt: sgst,
    igstPct: isIgst ? gstRate : 0,
    igstAmt: igst,
    cessPct: 0,
    cessAmt: cess,
    total: taxable + gst,
  };
  if (!taxRows.length || (gst > 0 && Math.abs(taxRowsGst - gst) > 0.5 && taxable > 0)) {
    taxRows = [billTaxRow];
  }

  const warnings = [];
  const firmName = String(firm.name || '').trim();
  if (!firm.gstin) warnings.push('Add Company GSTIN in Company Settings');
  if (!firmName) warnings.push('Set Business Legal Name in Company Settings');
  if (!party?.name) warnings.push('Bill-To party name is missing on this invoice');

  const shipTo =
    invoice.shipToName || invoice.shippingAddress
      ? {
        name: invoice.shipToName || party?.name,
        gstin: invoice.shipToGstin || party?.gstin,
        address: invoice.shippingAddress || partyAddress(party),
        addressLines: invoice.shippingAddress
          ? [invoice.shippingAddress]
          : partyAddressLines(party),
        state: invoice.shipToState || party?.state,
        stateCode: invoice.shipToStateCode || party?.stateCode,
        stateLabel: stateLabel(
          invoice.shipToState || party?.state,
          invoice.shipToStateCode || party?.stateCode
        ),
        phone: invoice.shipToPhone || party?.mobile || party?.phone || '',
        email: invoice.shipToEmail || party?.email || '',
      }
      : null;

  const billToSameAsShip =
    !shipTo ||
    (shipTo.name === party?.name &&
      (shipTo.address || '') === (partyAddress(party) || ''));

  const dueDays = Number(invoice.dueDays || 0);
  const paymentWithin =
    invoice.paymentTerms ||
    (dueDays > 0 ? `Payment within ${dueDays} days` : 'Payment within 10 days');

  const customTerms = String(firm.invoiceTerms || '')
    .split(/\n+/)
    .map((t) => t.replace(/^\d+[\).\-\s]+/, '').trim())
    .filter(Boolean);

  const partyGstin = normalizeGstin(party?.gstin);
  const partyStateCode =
    party?.stateCode || stateCodeFromGstin(party?.gstin) || stateCodeFromGstin(partyGstin) || '';
  const firmStateCode = firm.stateCode || stateCodeFromGstin(firm.gstin) || '';
  const posCode = partyStateCode || firmStateCode || '';
  const posState = party?.state || firm.state || '';

  const billParty = {
    name: party?.name || '—',
    gstin: partyGstin,
    address: partyAddress(party),
    addressLines: partyAddressLines(party),
    state: party?.state || '',
    stateCode: partyStateCode,
    stateLabel: stateLabel(party?.state, partyStateCode),
    phone: party?.mobile || party?.phone || party?.phoneO || '',
    email: party?.email || '',
    pan: party?.pan || '',
  };

  return {
    type,
    isSale,
    docTitle: isSale ? 'TAX INVOICE' : 'PURCHASE VOUCHER',
    copyLabel: String(copyLabel || 'ORIGINAL').toUpperCase(),
    meta: {
      invoiceNo: invoice.invoiceNo || '—',
      date: fmtDateDMY(invoice.date || invoice.createdAt) || fmtDate(invoice.date || invoice.createdAt),
      dueDate: resolveDueDatePrint(invoice),
      dueDays: dueDays || null,
      paymentTerms: paymentWithin,
      placeOfSupply: posState || '—',
      placeOfSupplyCode: posCode || '',
      placeOfSupplyLabel: stateLabel(posState, posCode) || posState || '—',
      reverseCharge: invoice.reverseCharge ? 'Y' : 'N',
      invoiceType: invoice.invoiceType || 'Tax',
      orderNo: invoice.orderNo || '',
      orderDate: invoice.orderDate ? fmtDateDMY(invoice.orderDate) : '',
      challanNo: invoice.challanNo || '',
      chDate: invoice.chDate ? fmtDateDMY(invoice.chDate) : '',
      transport: invoice.transport || '',
      lrNo: invoice.lrNo || '',
      lrDate: invoice.lrDate ? fmtDateDMY(invoice.lrDate) : '',
      station: invoice.station || '',
      eway: invoice.eway || '',
      baleNo: invoice.baleNo || '',
      freight: Number(invoice.freight || 0),
      weight: Number(invoice.weight || 0),
      broker: broker?.name || invoice.brokerName || '',
      brokerAddress: partyAddress(broker) || broker?.city || '',
      haste: invoice.haste || '',
      remarks: invoice.remarks || invoice.narration || '',
      supplierInvoiceNo: invoice.supplierInvoiceNo || '',
      irn: invoice.irn || invoice.einvoice?.irn || '',
      ackNo: invoice.ackNo || invoice.einvoice?.ackNo || '',
      ackDate: invoice.ackDate
        ? fmtDateDMY(invoice.ackDate)
        : invoice.einvoice?.ackDate
          ? fmtDateDMY(invoice.einvoice.ackDate)
          : '',
    },
    company: {
      ...firm,
      showLogo: showLogo !== false,
      logoMissing: showLogo && !firm.logoUrl,
      addressFull: [firm.address, firm.area].filter(Boolean).join(' ').trim(),
    },
    billTo: billParty,
    shipTo: billToSameAsShip
      ? billParty
      : {
        ...shipTo,
        gstin: normalizeGstin(shipTo?.gstin),
        stateLabel:
          shipTo?.stateLabel ||
          stateLabel(shipTo?.state, shipTo?.stateCode || stateCodeFromGstin(shipTo?.gstin)),
      },
    lines,
    lineTotals: {
      pcs: totalPcs,
      mts: totalMts,
      amount: totalLineAmount || taxable,
    },
    taxRows,
    isIgst,
    gstRate,
    totals: {
      grossAmount: taxable + discountTotal + Number(invoice.foldLess || 0),
      subtotal: taxable + discountTotal,
      discount: discountTotal,
      discountAmt,
      discountPer: Number(invoice.discountPer || 0),
      foldLess: Number(invoice.foldLess || 0),
      lessAmt: footerLess,
      lessPer: Number(invoice.lessPer || 0),
      addAmt: footerAdd,
      freight: Number(invoice.freight || 0),
      packing: Number(invoice.packing || invoice.totalAdd || 0),
      taxable,
      cgst,
      sgst,
      igst,
      cess,
      gst,
      tcs: Number(invoice.tcs || invoice.tcsAmount || 0),
      tcsPer: invoice.tcsPer || 0,
      roundOff: Number(invoice.roundOff || 0),
      grandTotal: net,
      amountWords: (() => {
        const rounded = Math.round(Number(net) || 0);
        return String(amountInWords(rounded))
          .replace(/^Indian Rupees\s+/i, 'Rupees. ')
          .replace(/^Zero Rupees/i, 'Rupees. Zero');
      })(),
    },
    // Group lines by HSN code for Tax Auditor HSN summary table
    hsnSummary: (() => {
      const groups = {};
      lines.forEach((l) => {
        const hsn = l.hsn || '5208';
        if (!groups[hsn]) {
          groups[hsn] = {
            hsn,
            taxable: 0,
            cgstRate: l.cgstPct || 0,
            cgstAmt: 0,
            sgstRate: l.sgstPct || 0,
            sgstAmt: 0,
            igstRate: l.igstPct || 0,
            igstAmt: 0,
            totalTax: 0,
          };
        }
        const g = groups[hsn];
        const tv = Number(l.taxable) || 0;
        g.taxable += tv;
        g.cgstAmt += Number(l.cgstAmt) || 0;
        g.sgstAmt += Number(l.sgstAmt) || 0;
        g.igstAmt += Number(l.igstAmt) || 0;
        g.totalTax += Number(l.gstAmt) || 0;
      });
      return Object.values(groups);
    })(),
    bank: {
      accountName: firm.accountName || firm.name,
      bankName: firm.bankName || '',
      accountNo: firm.accountNo || '',
      ifsc: firm.ifsc || '',
      branch: firm.bankBranch || '',
      upiId: firm.upiId || firm.upi || '',
      upiQrUrl: (firm.upiId || firm.upi)
        ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(`upi://pay?pa=${firm.upiId || firm.upi}&pn=${encodeURIComponent(firm.name || 'Company')}&am=${net.toFixed(2)}&cu=INR`)}`
        : null,
    },
    termsList: customTerms.length ? customTerms : DEFAULT_TERMS,
    terms:
      firm.invoiceTerms ||
      DEFAULT_TERMS.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    festival,
    showFestivalGreeting: !!(showFestivalGreeting && festival?.greeting),
    warnings,
    printMeta: {
      timestamp: printTimestamp(),
      generatedBy: 'ERP Billing System',
    },
    fmt: { money: fmtMoney, num: fmtNum, date: fmtDate, dateDMY: fmtDateDMY },
    _raw: { invoice, party, firm, broker },
  };
}

export { missing };
