import * as XLSX from 'xlsx';
import templates from './gstr1Templates.json' with { type: 'json' };

/**
 * GSTR-1 Excel in the layout of the government offline-utility template JSM fills
 * (GSTR1_V1.7.xlsx, GSTR1_V1.9.xlsx, GSTR1_V2_0.xlsx).
 *
 * gstr1Templates.json holds, for every sheet of each template, the first five rows exactly as the
 * template has them: the summary block and the column headers. JSM writes its data from row 5 (JSM's A5:… range, straight under the header), so
 * this does too. A column is filled by its header's own name, so a version whose header wording or
 * column set differs from another's (v1.7's HSN has no Rate; v1.9 and v2.0 do) gets exactly its own
 * columns. Sheets JSM leaves empty here (amendments, advances, e-commerce) keep their header rows.
 *
 * It reads the same data object exportGstr1Excel reads; nothing is recomputed.
 */
const num = (v) => Number(v || 0);

/** header text -> value, per sheet type. */
const FIELDS = {
  b2b: (r) => ({
    'GSTIN/UIN of Recipient': r.gstin || '', 'Receiver Name': r.partyName || '',
    'Invoice Number': r.invoiceNo || '', 'Invoice date': r.date || '', 'Invoice Value': num(r.netAmount),
    'Place Of Supply': r.stateName || '', 'Reverse Charge': r.reverseCharge || 'N',
    'Applicable % of Tax Rate': '', 'Invoice Type': r.invType || 'Regular', 'E-Commerce GSTIN': '',
    Rate: parseFloat(r.taxRate) || 0, 'Taxable Value': num(r.taxableAmount), 'Cess Amount': num(r.cess),
  }),
  b2cl: (r) => ({
    'Invoice Number': r.invoiceNo || '', 'Invoice date': r.date || '', 'Invoice Value': num(r.netAmount),
    'Place Of Supply': r.stateName || '', 'Applicable % of Tax Rate': '', Rate: parseFloat(r.taxRate) || 0,
    'Taxable Value': num(r.taxableAmount), 'Cess Amount': num(r.cess), 'E-Commerce GSTIN': r.ecomm || '',
  }),
  b2cs: (r) => ({
    Type: r.typ || 'OE', 'Place Of Supply': r.pos_name || `${r.pos || ''}`, 'Applicable % of Tax Rate': r.app_rate || '',
    Rate: parseFloat(r.rt) || 0, 'Taxable Value': num(r.txval), 'Cess Amount': num(r.csamt), 'E-Commerce GSTIN': r.ecomm || '',
  }),
  cdnr: (r) => ({
    'GSTIN/UIN of Recipient': r.gstin || '', 'Receiver Name': r.partyName || '',
    'Note Number': r.noteNo || '', 'Note Date': r.noteDate || '', 'Note Type': r.noteType === 'C' ? 'C' : 'D',
    'Place Of Supply': r.pos || '', 'Reverse Charge': 'N', 'Note Supply Type': 'Regular',
    'Note Value': num(r.netAmount), 'Applicable % of Tax Rate': '', Rate: parseFloat(r.taxRate) || 0,
    'Taxable Value': num(r.taxableAmount), 'Cess Amount': num(r.cess),
  }),
  cdnur: (r) => ({
    'UR Type': r.type || 'B2CS', 'Note Number': r.noteNo || '', 'Note Date': r.noteDate || '',
    'Note Type': r.noteType === 'C' ? 'C' : 'D', 'Place Of Supply': r.pos || '', 'Note Value': num(r.netAmount),
    'Applicable % of Tax Rate': '', Rate: parseFloat(r.taxRate) || 0,
    'Taxable Value': num(r.taxableAmount), 'Cess Amount': num(r.cess),
  }),
  exp: (r) => ({
    'Export Type': r.exportType || 'WOPAY', 'Invoice Number': r.invoiceNo || '', 'Invoice date': r.date || '',
    'Invoice Value': num(r.invoiceValue), 'Port Code': r.portCode || '', 'Shipping Bill Number': r.shippingBillNo || '',
    'Shipping Bill Date': r.shippingBillDate || '', Rate: parseFloat(r.taxRate) || 0,
    'Taxable Value': num(r.taxableAmount), 'Cess Amount': num(r.cess),
  }),
  hsn: (r) => ({
    HSN: r.hsn_sc || '', Description: r.desc || '', UQC: r.uqcDesc || r.uqc || 'PCS', 'Total Quantity': num(r.qty),
    'Total Value': num(r.val), Rate: num(r.rt), 'Taxable Value': num(r.txval),
    'Integrated Tax Amount': num(r.iamt), 'Central Tax Amount': num(r.camt),
    'State/UT Tax Amount': num(r.samt), 'Cess Amount': num(r.csamt),
  }),
  exemp: (r) => ({
    Description: r.description || '', 'Nil Rated Supplies': num(r.nilRated),
    'Exempted(other than nil rated/non GST supply)': num(r.exempted), 'Non-GST Supplies': num(r.nonGst),
  }),
  docs: (r) => ({
    'Nature of Document': r.docType || '', 'Sr. No. From': r.from || '', 'Sr. No. To': r.to || '',
    'Total Number': num(r.totnum), Cancelled: num(r.cancel),
  }),
};

/** which data array feeds which sheet (the sheet name's first word decides) */
const SOURCE = {
  b2b: 'b2bRows', b2cl: 'b2clRows', b2cs: 'b2cs', cdnr: 'cdnrRows', cdnur: 'cdnuRows',
  exp: 'expRows', hsn: 'hsnRows', exemp: 'exempRows', docs: 'docsRows',
};
const kindOf = (name) => {
  const k = String(name).split(',')[0].trim();
  return SOURCE[k] ? k : null;
};
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%]/g, '');

export const GSTR1_TEMPLATE_VERSIONS = Object.keys(templates);

/** Build the workbook for one template version from the GSTR-1 data object. */
export function buildGstr1TemplateWorkbook(data, version) {
  const tpl = templates[version];
  if (!tpl) throw new Error(`Unknown GSTR-1 template version: ${version}`);
  const wb = XLSX.utils.book_new();

  for (const sheet of tpl.sheets) {
    const header = sheet.rows[3] || [];
    const kind = kindOf(sheet.name);
    const rows = kind ? (data[SOURCE[kind]] || []) : [];
    const aoa = sheet.rows.slice(0, 4).map((r) => [...r]);

    const body = rows.map((r) => {
      const by = Object.fromEntries(Object.entries(FIELDS[kind](r)).map(([k, v]) => [norm(k), v]));
      return header.map((h) => (norm(h) in by ? by[norm(h)] : ''));
    });
    aoa.push(...body);

    // The summary row (row 3) holds the template's totals; fill the ones a column of data backs.
    if (kind && body.length) {
      const sum = (title) => {
        const i = header.findIndex((h) => norm(h) === norm(title));
        return i < 0 ? 0 : body.reduce((t, r) => t + num(r[i]), 0);
      };
      const labels = sheet.rows[1] || [];
      aoa[2] = (aoa[2] || []).map((v, i) => {
        const label = String(labels[i] || '').toLowerCase();
        if (label.includes('total invoice value')) return sum('Invoice Value');
        if (label.includes('total note value')) return sum('Note Value');
        if (label.includes('total taxable')) return sum('Taxable Value');
        if (label.includes('total cess')) return sum('Cess Amount');
        if (label.includes('total integrated')) return sum('Integrated Tax Amount');
        if (label.includes('total central')) return sum('Central Tax Amount');
        if (label.includes('total state')) return sum('State/UT Tax Amount');
        if (label === 'total value') return sum('Total Value');
        if (label.includes('no. of invoices') || label.includes('no. of notes') || label.includes('no. of hsn')) return body.length;
        return v;
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet.name);
  }
  return wb;
}

export const exportGstr1TemplateExcel = (data, version, filename) => {
  XLSX.writeFile(buildGstr1TemplateWorkbook(data, version), filename || `GSTR1_${version}.xlsx`);
};
