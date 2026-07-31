/** Print utility helpers */

export function printTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function hasValue(v) {
  if (v == null) return false;
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
}

export function joinParts(parts, sep = ' · ') {
  return parts.filter((p) => hasValue(p)).join(sep);
}

export function addressLines(party) {
  if (!party) return [];
  if (party.addressLines?.length) return party.addressLines;
  if (party.address) return [party.address];
  return [];
}

/** Build totals rows for financial summary panels */
export function buildTotalsRows(data) {
  const { totals, meta, isIgst } = data;
  const fmt = data.fmt;
  const rows = [];

  const push = (label, value, opts = {}) => {
    if (opts.skipZero && !Number(value)) return;
    if (opts.skipEmpty && !hasValue(value)) return;
    rows.push({ label, value: fmt.money(value), bold: opts.bold, accent: opts.accent });
  };

  push('Gross Amount', totals.grossAmount, { skipZero: true });
  push('Discount', totals.discount, { skipZero: true });
  push('Fold Less', totals.foldLess, { skipZero: true });
  push('Additional Charges', totals.addAmt, { skipZero: true });
  push('Freight', meta.freight || totals.freight, { skipZero: true });
  push('Packing', totals.packing, { skipZero: true });
  push('Less Amount', totals.lessAmt, { skipZero: true });
  push('Taxable Value', totals.taxable, { bold: true });

  if (isIgst) {
    push(`IGST @ ${data.gstRate || ''}%`, totals.igst, { skipZero: true });
  } else {
    push(`CGST @ ${(data.gstRate || 0) / 2}%`, totals.cgst, { skipZero: true });
    push(`SGST @ ${(data.gstRate || 0) / 2}%`, totals.sgst, { skipZero: true });
  }

  if (totals.cess) push('CESS', totals.cess);
  if (totals.tcs) push(`TCS${totals.tcsPer ? ` @ ${totals.tcsPer}%` : ''}`, totals.tcs, { skipZero: true });
  push('Round Off', totals.roundOff, { skipZero: true });
  push('Grand Total', totals.grandTotal, { bold: true, accent: true });

  return rows;
}

export function metaFields(data) {
  const { meta } = data;
  return [
    { label: 'Invoice No', value: meta.invoiceNo },
    { label: 'Date', value: meta.date },
    { label: 'Due Date', value: meta.dueDate },
    { label: 'Order No', value: meta.orderNo },
    { label: 'Challan No', value: meta.challanNo },
    { label: 'Reference', value: meta.supplierInvoiceNo },
    { label: 'Payment Terms', value: meta.paymentTerms },
    { label: 'Place of Supply', value: meta.placeOfSupplyLabel },
    { label: 'Transport', value: meta.transport },
    { label: 'LR No', value: meta.lrNo },
    { label: 'Broker', value: meta.broker },
    { label: 'E-Way Bill', value: meta.eway },
    { label: 'IRN', value: meta.irn },
  ].filter((f) => hasValue(f.value));
}
