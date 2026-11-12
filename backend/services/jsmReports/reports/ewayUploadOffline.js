'use strict';

/**
 * JSM: Others Reports > Old Reports > Extra Reports > Brif Cash (Eway_No_Upload_Offline)
 * Uploads E-Way Bill Excel/JSON rows and writes EWB No back onto matching Sales invoices
 * (no tax/GST calculation changes — additive eway reference update only).
 */
const { orderRows, round } = require('../jcEngine');

async function run(companyId, p = {}, deps = {}) {
  const Sales = deps.Sales || require('../../../models/Sales');
  const uploaded = Array.isArray(p.ewayRows) ? p.ewayRows : [];
  let updated = 0;

  if (uploaded.length) {
    const out = [];
    for (let i = 0; i < uploaded.length; i += 1) {
      const r = uploaded[i];
      const docNo = String(r.docNo || r.NCBILL_NO || r.billNo || '').trim();
      const ewbNo = String(r.ewbNo || r.EWB_NO || '').trim();
      let matched = false;
      if (docNo && ewbNo && p.action === 'btn_Export_data_Sales') {
        const res = await Sales.updateOne(
          { companyId, invoiceNo: docNo, status: { $ne: 'cancelled' } },
          { $set: { eway: ewbNo } }
        );
        matched = (res.modifiedCount || res.matchedCount || 0) > 0;
        if (matched) updated += 1;
      }
      out.push({
        SL_NO: i + 1,
        SUPPLY_TYPE: r.supplyType || 'Outward',
        DOC_NO: docNo,
        DOC_DATE: r.docDate || null,
        PARTY_GSTIN: r.partyGstin || '',
        VEHICLE_NO: r.vehicleNo || '',
        EWB_NO: ewbNo,
        EWB_DATE: r.ewbDate || '',
        EWB_STATUS: p.action === 'btn_Export_data_Sales' ? (matched ? 'UPDATED' : 'NOT FOUND') : 'READY',
      });
    }
    return {
      rows: out,
      grid: {
        layout: 'JSM_VW_EWAY_UPLOAD',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: 'E-Way Bill Offline Upload & Sales Sync',
        period: `${uploaded.length} uploaded row(s)`,
        pageWise: false,
        notice: p.action === 'btn_Export_data_Sales' ? `Updated EWB No on ${updated} sales invoice(s).` : 'Click "Update Sale Data" to write uploaded EWB numbers to matching Sales bills.',
      },
    };
  }

  // No file uploaded yet: list recent Sales invoices for offline E-Way generation preview
  const docs = deps.sales || await Sales.find({ companyId, status: { $ne: 'cancelled' } })
    .populate('partyId', 'name gstin state')
    .sort({ date: -1 })
    .limit(200)
    .lean();

  const rows = docs.map((s, idx) => ({
    SL_NO: idx + 1,
    SUPPLY_TYPE: 'Outward',
    DOC_NO: s.invoiceNo || '',
    DOC_DATE: s.date || null,
    PARTY_GSTIN: s.partyId?.gstin || '',
    VEHICLE_NO: s.transport || '',
    EWB_NO: s.eway || '',
    EWB_DATE: '',
    NET_AMT: round(s.netAmount || 0),
    EWB_STATUS: s.eway ? 'LINKED' : 'PENDING',
  }));

  return {
    rows: orderRows(rows, ['DOC_DATE', 'DOC_NO']),
    grid: {
      layout: 'JSM_VW_EWAY_UPLOAD',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'E-Way Bill Offline / Upload Preview',
      period: 'Recent Sales Invoices (Browse Excel to Upload EWB Nos.)',
      pageWise: false,
    },
  };
}

module.exports = { run, options: async () => ({}) };
