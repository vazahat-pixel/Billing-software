/**
 * The NIC "bulk generation" JSON built from the rows of JSM's E-Way Bill Bulk Generation grid
 * (one row per item line, grouped by document number into one bill each).
 */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const UNIT_CODE = {
  MTRS: 'MTR', MTR: 'MTR', METER: 'MTR', METERS: 'MTR', PCS: 'PCS', KGS: 'KGS', KG: 'KGS', NOS: 'NOS',
};

export function buildEwayBulkJson(rows) {
  const bills = new Map();
  for (const r of rows || []) {
    const key = `${r.DOC_NO}|${r.DOC_DATE}`;
    if (!bills.has(key)) {
      bills.set(key, {
        userGstin: r.FRM_GSTN,
        supplyType: 'O',
        subSupplyType: 1,
        docType: 'INV',
        docNo: r.DOC_NO,
        docDate: r.DOC_DATE,
        transType: 1,
        fromGstin: r.FRM_GSTN,
        fromTrdName: r.FRM_PRTY_NAME,
        fromAddr1: r.FRM_ADD1,
        fromAddr2: r.FRM_ADD2,
        fromPlace: r.FRM_PLACE,
        fromPincode: num(r.FRM_PINCODE),
        fromStateCode: num(r.FRM_ACT_STATE_CODE),
        actualFromStateCode: num(r.FRM_ACT_STATE_CODE),
        toGstin: r.TO_GSTN,
        toTrdName: r.TO_PRTY_NAME,
        toAddr1: r.TO_ADD1,
        toAddr2: r.TO_ADD2,
        toPlace: r.TO_PLACE,
        toPincode: num(r.TO_PINCODE),
        toStateCode: num(r.TO_ACT_STATE_CODE),
        actualToStateCode: num(r.TO_ACT_STATE_CODE),
        totalValue: 0,
        cgstValue: 0,
        sgstValue: 0,
        igstValue: 0,
        cessValue: 0,
        totInvValue: num(r.TOT_INV_VALUE),
        transMode: 1,
        transDistance: String(r.DISTANCE || ''),
        transporterName: r.TRAN_NAME || '',
        transporterId: r.TRAN_GSTN || '',
        transDocNo: r.TRNS_DOCNO || '',
        transDocDate: r.TRNS_DATE || '',
        vehicleNo: r.VEHICAL_NO || '',
        vehicleType: r.VEHICAL_TYPE || 'R',
        mainHsnCode: num(r.MAIN_HSN_CODE),
        itemList: [],
      });
    }
    const b = bills.get(key);
    const taxable = num(r.ACC_VALUE);
    const rate = num(r.TAX_RATE);
    b.totalValue = Number((b.totalValue + taxable).toFixed(2));
    b.cgstValue = Number((b.cgstValue + num(r.CGST_AMT)).toFixed(2));
    b.sgstValue = Number((b.sgstValue + num(r.SGST_AMT)).toFixed(2));
    b.igstValue = Number((b.igstValue + num(r.IGST_AMT)).toFixed(2));
    const intra = num(r.IGST_AMT) === 0;
    b.itemList.push({
      itemNo: b.itemList.length + 1,
      productName: r.PRO_NAME,
      productDesc: r.PRO_DESC,
      hsnCode: num(r.PRO_HSN),
      quantity: num(r.PRO_QTY),
      qtyUnit: UNIT_CODE[String(r.PRO_UNIT || '').toUpperCase()] || 'OTH',
      taxableAmount: taxable,
      sgstRate: intra ? rate / 2 : 0,
      cgstRate: intra ? rate / 2 : 0,
      igstRate: intra ? 0 : rate,
      cessRate: 0,
    });
  }
  return { version: '1.0.0621', billLists: [...bills.values()] };
}
