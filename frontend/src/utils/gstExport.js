import * as XLSX from 'xlsx';

export const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getMonthDateRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

export const buildGstr1Filename = (startDate, endDate) => {
  const stamp = startDate?.slice(0, 7) || 'export';
  return `GSTR1_${stamp}_${endDate || 'range'}.json`;
};

/**
 * Export full GSTR-1 Excel (.xlsx) workbook compatible with Government GST Offline Utility V3.2.2
 */
export const exportGstr1Excel = (data, filename = 'GSTR1_V3_2_2.xlsx') => {
  const wb = XLSX.utils.book_new();

  // 1. b2b sheet
  const b2bRows = (data.b2bRows || []).map((r) => ({
    'GSTIN/UIN of Recipient': r.gstin || '',
    'Receiver Name': r.partyName || '',
    'Invoice Number': r.invoiceNo || '',
    'Invoice date': r.date || '',
    'Invoice Value': Number(r.netAmount || 0),
    'Place Of Supply': r.stateName || '',
    'Reverse Charge': r.reverseCharge || 'N',
    'Applicable % of Tax Rate': '',
    'Invoice Type': r.invType || 'Regular',
    'E-Commerce GSTIN': '',
    'Rate': parseFloat(r.taxRate) || 0,
    'Taxable Value': Number(r.taxableAmount || 0),
    'Cess Amount': Number(r.cess || 0),
  }));
  const b2bSheet = XLSX.utils.json_to_sheet(b2bRows.length ? b2bRows : [{ 'GSTIN/UIN of Recipient': '' }]);
  XLSX.utils.book_append_sheet(wb, b2bSheet, 'b2b');

  // 2. b2cl sheet
  const b2clRows = (data.b2clRows || []).map((r) => ({
    'Invoice Number': r.invoiceNo || '',
    'Invoice date': r.date || '',
    'Invoice Value': Number(r.netAmount || 0),
    'Place Of Supply': r.stateName || '',
    'Applicable % of Tax Rate': '',
    'Rate': parseFloat(r.taxRate) || 0,
    'Taxable Value': Number(r.taxableAmount || 0),
    'Cess Amount': Number(r.cess || 0),
    'E-Commerce GSTIN': r.ecomm || '',
  }));
  const b2clSheet = XLSX.utils.json_to_sheet(b2clRows.length ? b2clRows : [{ 'Invoice Number': '' }]);
  XLSX.utils.book_append_sheet(wb, b2clSheet, 'b2cl');

  // 3. b2cs sheet
  const b2csRows = (data.b2cs || []).map((r) => ({
    'Type': r.typ || 'OE',
    'Place Of Supply': r.pos_name || `${r.pos || ''}`,
    'Applicable % of Tax Rate': r.app_rate || '',
    'Rate': parseFloat(r.rt) || 0,
    'Taxable Value': Number(r.txval || 0),
    'Cess Amount': Number(r.csamt || 0),
    'E-Commerce GSTIN': r.ecomm || '',
  }));
  const b2csSheet = XLSX.utils.json_to_sheet(b2csRows.length ? b2csRows : [{ 'Type': 'OE' }]);
  XLSX.utils.book_append_sheet(wb, b2csSheet, 'b2cs');

  // 4. cdnr sheet
  const cdnrRows = (data.cdnrRows || []).map((r) => ({
    'GSTIN/UIN of Recipient': r.gstin || '',
    'Receiver Name': r.partyName || '',
    'Note/Refund Voucher Number': r.noteNo || '',
    'Note/Refund Voucher date': r.noteDate || '',
    'Document Type': r.noteType === 'C' ? 'C' : 'D',
    'Place Of Supply': r.pos || '',
    'Reverse Charge': 'N',
    'Note Supply Type': 'Regular',
    'Note/Refund Voucher Value': Number(r.netAmount || 0),
    'Applicable % of Tax Rate': '',
    'Rate': parseFloat(r.taxRate) || 0,
    'Taxable Value': Number(r.taxableAmount || 0),
    'Cess Amount': Number(r.cess || 0),
  }));
  const cdnrSheet = XLSX.utils.json_to_sheet(cdnrRows.length ? cdnrRows : [{ 'GSTIN/UIN of Recipient': '' }]);
  XLSX.utils.book_append_sheet(wb, cdnrSheet, 'cdnr');

  // 5. cdnur sheet
  const cdnurRows = (data.cdnuRows || []).map((r) => ({
    'UR Type': r.type || 'B2CS',
    'Note/Refund Voucher Number': r.noteNo || '',
    'Note/Refund Voucher date': r.noteDate || '',
    'Document Type': r.noteType === 'C' ? 'C' : 'D',
    'Place Of Supply': r.pos || '',
    'Note/Refund Voucher Value': Number(r.netAmount || 0),
    'Applicable % of Tax Rate': '',
    'Rate': parseFloat(r.taxRate) || 0,
    'Taxable Value': Number(r.taxableAmount || 0),
    'Cess Amount': Number(r.cess || 0),
  }));
  const cdnurSheet = XLSX.utils.json_to_sheet(cdnurRows.length ? cdnurRows : [{ 'UR Type': 'B2CS' }]);
  XLSX.utils.book_append_sheet(wb, cdnurSheet, 'cdnur');

  // 6. exp sheet
  const expRows = (data.expRows || []).map((r) => ({
    'Export Type': r.exportType || 'WOPAY',
    'Invoice Number': r.invoiceNo || '',
    'Invoice date': r.date || '',
    'Invoice Value': Number(r.invoiceValue || 0),
    'Port Code': r.portCode || '',
    'Shipping Bill Number': r.shippingBillNo || '',
    'Shipping Bill Date': r.shippingBillDate || '',
    'Rate': parseFloat(r.taxRate) || 0,
    'Taxable Value': Number(r.taxableAmount || 0),
    'Cess Amount': Number(r.cess || 0),
  }));
  const expSheet = XLSX.utils.json_to_sheet(expRows.length ? expRows : [{ 'Export Type': 'WOPAY' }]);
  XLSX.utils.book_append_sheet(wb, expSheet, 'exp');

  // 7. hsn sheet
  const hsnRows = (data.hsnRows || []).map((r) => ({
    'HSN': r.hsn_sc || '',
    'Description': r.desc || '',
    'UQC': r.uqc || 'PCS',
    'Total Quantity': Number(r.qty || 0),
    'Total Value': Number(r.val || 0),
    'Taxable Value': Number(r.txval || 0),
    'Integrated Tax Amount': Number(r.iamt || 0),
    'Central Tax Amount': Number(r.camt || 0),
    'State/UT Tax Amount': Number(r.samt || 0),
    'Cess Amount': Number(r.csamt || 0),
  }));
  const hsnSheet = XLSX.utils.json_to_sheet(hsnRows.length ? hsnRows : [{ 'HSN': '' }]);
  XLSX.utils.book_append_sheet(wb, hsnSheet, 'hsn');

  // 8. hsn_b2c sheet
  const hsnB2cRows = (data.hsnB2cRows || []).map((r) => ({
    'HSN': r.hsn_sc || '',
    'Description': r.desc || '',
    'UQC': r.uqc || 'PCS',
    'Total Quantity': Number(r.qty || 0),
    'Total Value': Number(r.val || 0),
    'Taxable Value': Number(r.txval || 0),
    'Integrated Tax Amount': Number(r.iamt || 0),
    'Central Tax Amount': Number(r.camt || 0),
    'State/UT Tax Amount': Number(r.samt || 0),
    'Cess Amount': Number(r.csamt || 0),
  }));
  const hsnB2cSheet = XLSX.utils.json_to_sheet(hsnB2cRows.length ? hsnB2cRows : [{ 'HSN': '' }]);
  XLSX.utils.book_append_sheet(wb, hsnB2cSheet, 'hsn_b2c');

  // 9. exemp sheet
  const exempRows = (data.exempRows || []).map((r) => ({
    'Description': r.description || '',
    'Nil Rated Supplies': Number(r.nilRated || 0),
    'Exempted (other than nil rated/non GST supply)': Number(r.exempted || 0),
    'Non-GST supplies': Number(r.nonGst || 0),
  }));
  const exempSheet = XLSX.utils.json_to_sheet(exempRows.length ? exempRows : [{ 'Description': '' }]);
  XLSX.utils.book_append_sheet(wb, exempSheet, 'exemp');

  // 10. docs sheet
  const docsRows = (data.docsRows || []).map((r) => ({
    'Nature of Document': r.docType || '',
    'Sr. No. From': r.from || '',
    'Sr. No. To': r.to || '',
    'Total Number': Number(r.totnum || 0),
    'Cancelled': Number(r.cancel || 0),
    'Net Issued': Number(r.net_issue || 0),
  }));
  const docsSheet = XLSX.utils.json_to_sheet(docsRows.length ? docsRows : [{ 'Nature of Document': '' }]);
  XLSX.utils.book_append_sheet(wb, docsSheet, 'docs');

  // Save workbook
  XLSX.writeFile(wb, filename);
};
