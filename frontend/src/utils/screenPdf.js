import { jsPDF } from 'jspdf';

const money = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Open a jsPDF document in the browser PDF viewer (same as a downloaded report). */
export function openPdfInViewer(doc, filename = 'report.pdf') {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const viewer = window.open(url, '_blank', 'noopener,noreferrer');
  if (!viewer) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return Boolean(viewer);
}

function stampHeader(doc, { companyName, companyAddress, gstin, title, subtitle }) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date();
  const stamp = now.toLocaleString('en-GB', { hour12: false }).replace(',', '');
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.text(stamp, pageW - 12, 8, { align: 'right' });
  doc.text(`PAGE NO. ${doc.internal.getNumberOfPages()}`, pageW - 12, 12, { align: 'right' });

  let y = 14;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  const nameLines = doc.splitTextToSize(String(companyName || 'Company'), pageW - 70);
  doc.text(nameLines, pageW / 2, y, { align: 'center' });
  y += nameLines.length * 6;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  if (companyAddress) {
    const addr = doc.splitTextToSize(String(companyAddress), pageW - 40);
    doc.text(addr, pageW / 2, y, { align: 'center' });
    y += addr.length * 4;
  }
  if (gstin) {
    doc.text(`GST NO: ${gstin}`, pageW / 2, y, { align: 'center' });
    y += 4;
  }
  y += 1;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(title || 'Report', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  if (subtitle) {
    doc.text(subtitle, pageW / 2, y, { align: 'center' });
    y += 5;
  }
  return { y, pageW, pageH };
}

/**
 * Classic account-ledger PDF (Date, Bill/Vou, Description, ChqNo, Debit, Credit, Balance).
 */
export function openLedgerScreenPdf(opts) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let { y } = stampHeader(doc, {
    companyName: opts.companyName,
    companyAddress: opts.companyAddress,
    gstin: opts.gstin,
    title: 'Account Ledger Report',
    subtitle: `DATE : FROM ${opts.fromLabel || ''} TO ${opts.toLabel || ''}`,
  });

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text(`Account : ${opts.accountName || ''}`, 12, y);
  doc.setFont('times', 'normal');
  const group = String(opts.accountGroup || '').toUpperCase();
  if (group) doc.text(group, pageW - 12, y, { align: 'right' });
  y += 2;
  doc.setLineWidth(0.2);
  doc.line(12, y, pageW - 12, y);
  y += 4;

  const cols = [
    { x: 12, w: 18, align: 'left', label: 'Date' },
    { x: 30, w: 28, align: 'left', label: 'Bill/Vou' },
    { x: 58, w: 52, align: 'left', label: 'Description' },
    { x: 110, w: 18, align: 'left', label: 'ChqNo' },
    { x: 128, w: 22, align: 'right', label: 'Debit' },
    { x: 150, w: 22, align: 'right', label: 'Credit' },
    { x: 172, w: 26, align: 'right', label: 'Balance' },
  ];

  const paintHead = () => {
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    cols.forEach((c) => {
      const x = c.align === 'right' ? c.x + c.w : c.x;
      doc.text(c.label, x, y, { align: c.align });
    });
    y += 1.2;
    doc.line(12, y, pageW - 12, y);
    y += 4;
    doc.setFont('times', 'normal');
  };
  paintHead();

  const paintRow = (cells, bold) => {
    if (y > 282) {
      doc.addPage();
      y = 16;
      paintHead();
    }
    doc.setFont('times', bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    cells.forEach((value, i) => {
      const c = cols[i];
      if (!c) return;
      const raw = String(value ?? '');
      const fitted = doc.splitTextToSize(raw, c.w)[0] || '';
      const x = c.align === 'right' ? c.x + c.w : c.x;
      doc.text(fitted, x, y, { align: c.align });
    });
    y += 4.2;
  };

  (opts.rows || []).forEach((row) => paintRow(row, false));
  y += 1;
  doc.line(12, y, pageW - 12, y);
  y += 5;
  paintRow([
    '',
    '',
    'Total',
    '',
    money(opts.totalDebit),
    money(opts.totalCredit),
    opts.closingLabel || '',
  ], true);

  openPdfInViewer(doc, opts.filename || 'Account-Ledger.pdf');
}

/** Outstanding statement PDF — party aging plus each open bill. */
export function openOutstandingScreenPdf(opts) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  let { y } = stampHeader(doc, {
    companyName: opts.companyName,
    companyAddress: opts.companyAddress,
    gstin: opts.gstin,
    title: opts.title || 'Outstanding Report',
    subtitle: opts.subtitle || '',
  });

  const cols = [
    { x: 12, w: 70, align: 'left', label: 'Party / Bill' },
    { x: 84, w: 28, align: 'right', label: '0-30' },
    { x: 114, w: 28, align: 'right', label: '31-60' },
    { x: 144, w: 28, align: 'right', label: '61-90' },
    { x: 174, w: 28, align: 'right', label: '90+' },
    { x: 206, w: 32, align: 'right', label: 'Outstanding' },
    { x: 240, w: 40, align: 'left', label: 'Follow-up' },
  ];

  const paintHead = () => {
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    cols.forEach((c) => {
      const x = c.align === 'right' ? c.x + c.w : c.x;
      doc.text(c.label, x, y, { align: c.align });
    });
    y += 1.2;
    doc.line(12, y, pageW - 12, y);
    y += 4;
    doc.setFont('times', 'normal');
  };
  paintHead();

  const paint = (cells, bold) => {
    if (y > 195) {
      doc.addPage();
      y = 16;
      paintHead();
    }
    doc.setFont('times', bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    cells.forEach((value, i) => {
      const c = cols[i];
      if (!c) return;
      const fitted = doc.splitTextToSize(String(value ?? ''), c.w)[0] || '';
      const x = c.align === 'right' ? c.x + c.w : c.x;
      doc.text(fitted, x, y, { align: c.align });
    });
    y += 4.2;
  };

  (opts.parties || []).forEach((party) => {
    paint([
      party.partyName || '',
      money(party.aging?.bucket30),
      money(party.aging?.bucket60),
      money(party.aging?.bucket90),
      money(party.aging?.bucket90Plus),
      money(party.totalOutstanding),
      '',
    ], true);
    (party.bills || []).forEach((b) => {
      const when = [b.billDate, b.dueDate ? `due ${b.dueDate}` : ''].filter(Boolean).join(' · ');
      paint([
        `    ${b.billNo || ''}  ${when}  ${b.ageDays != null ? `${b.ageDays}d` : ''}`,
        '',
        '',
        '',
        '',
        money(b.outstanding),
        b.followUpStatus || '',
      ], false);
    });
  });

  y += 1;
  doc.line(12, y, pageW - 12, y);
  y += 5;
  paint(['Grand Total', '', '', '', '', money(opts.grandTotal), ''], true);

  openPdfInViewer(doc, opts.filename || 'Outstanding.pdf');
}
