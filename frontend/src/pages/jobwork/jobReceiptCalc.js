/** Job Receipt (Additional Job Receipt) line & bill calculations */

export const PQK_OPTIONS = [
  { value: 'P', label: 'Pcs' },
  { value: 'Q', label: 'Qty' },
  { value: 'K', label: 'Kgs' },
];

export const TYPE_OPTIONS = [
  { value: 'INVOICE IN STATE', label: 'INVOICE IN STATE' },
  { value: 'INVOICE OUT STATE', label: 'INVOICE OUT STATE' },
  { value: 'EXPORT', label: 'EXPORT' },
];

export const RCM_OPTIONS = [
  { value: 'No', label: 'No' },
  { value: 'Yes', label: 'Yes' },
];

export const blankLine = () => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  jobId: '',
  chlnNo: '',
  itemName: '',
  finishItem: '',
  cut: '',
  recPcs: '',
  recMts: '',
  jRate: '',
  pqk: 'Q',
  jobAmt: 0,
  cp: '',
  jobcardNo: '',
});

export const lineQty = (line) => {
  if (line.pqk === 'P') return Number(line.recPcs) || 0;
  if (line.pqk === 'K') return Number(line.recMts) || 0;
  return Number(line.recMts) || 0;
};

export const lineJobAmt = (line) => {
  const qty = lineQty(line);
  const rate = Number(line.jRate) || 0;
  return Number((qty * rate).toFixed(2));
};

export const jobToLine = (job) => {
  const issueQty = Number(job.issueQty) || 0;
  const rate =
    Number(job.jobRate) ||
    (issueQty > 0 ? Number(job.processCharges || 0) / issueQty : 0) ||
    0;
  const itemName =
    job.lotId?.itemId?.name ||
    job.lotId?.itemName ||
    job.lotId?.name ||
    '';

  const line = {
    id: job._id,
    jobId: job._id,
    chlnNo: job.challanNo || job.jobCardNo || '',
    itemName,
    finishItem: job.outputItemId?.name || job.finish || '',
    cut: '',
    recPcs: job.issuePcs ?? '',
    recMts: job.issueQty ?? '',
    jRate: rate ? rate.toFixed(2) : '',
    pqk: 'Q',
    jobAmt: 0,
    cp: '',
    jobcardNo: job.jobCardNo || '',
  };
  line.jobAmt = lineJobAmt(line);
  return line;
};

export const calcJobReceipt = (lines, footer, header) => {
  const linesWithAmt = (lines || []).map((l) => ({
    ...l,
    jobAmt: lineJobAmt(l),
  }));

  const gross = linesWithAmt.reduce((s, l) => s + (Number(l.jobAmt) || 0), 0);
  const add = Number(footer.addAmt) || 0;
  const less = Number(footer.lessAmt) || 0;
  const ol1 = Number(footer.otherLess1Amt) || 0;
  const ol2 = Number(footer.otherLess2Amt) || 0;
  const taxable = Math.max(0, gross + add - less - ol1 - ol2);

  const taxRate = Number(footer.taxRate) || 0;
  const inState = header.type === 'INVOICE IN STATE';
  const gstTotal = (taxable * taxRate) / 100;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (inState) {
    cgst = gstTotal / 2;
    sgst = gstTotal / 2;
  } else {
    igst = gstTotal;
  }
  const totalGst = cgst + sgst + igst;

  const tdsOn = Number(footer.tdsOnAmount) || taxable;
  const tdsPct = Number(footer.tdsPercent) || 0;
  const tdsAmt = (tdsOn * tdsPct) / 100;

  const rcm = header.reverseCharge === 'Yes' ? Number(footer.rcmCharge) || 0 : 0;
  const net = taxable + totalGst + rcm - tdsAmt;
  const roundOff = Number(footer.roundOff) || 0;
  const final = net + roundOff;

  return {
    gross,
    taxable,
    cgst,
    sgst,
    igst,
    totalGst,
    tdsAmt,
    net,
    final,
    linesWithAmt,
  };
};
