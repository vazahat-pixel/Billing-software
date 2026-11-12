import * as XLSX from 'xlsx';

async function parseEwayFile(file) {
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(await file.text());
    const arr = Array.isArray(parsed) ? parsed : (parsed.billLists || parsed.rows || []);
    return {
      txt_brows: `${file.name} (${arr.length} rows)`,
      __ewayRows: arr.map((r) => ({
        supplyType: r.supplyType || 'Outward',
        docNo: r.docNo || r.NCBILL_NO || r.billNo || '',
        docDate: r.docDate || '',
        partyGstin: r.toGstin || r.partyGstin || '',
        vehicleNo: r.vehicleNo || '',
        ewbNo: r.ewayBillNo || r.ewbNo || r.EWB_NO || '',
        ewbDate: r.ewayBillDate || r.ewbDate || '',
      })),
    };
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return {
    txt_brows: `${file.name} (${json.length} rows)`,
    __ewayRows: json.map((r) => ({
      supplyType: r['Supply Type'] || r.supplyType || 'Outward',
      docNo: r['Doc No.'] || r['Doc No'] || r.NCBILL_NO || r.docNo || '',
      docDate: r['Doc.Date'] || r['Doc Date'] || r.docDate || '',
      partyGstin: r['Prty.Gstn'] || r.GSTIN || r.partyGstin || '',
      vehicleNo: r['Vehical.No'] || r['Vehicle No'] || r.vehicleNo || '',
      ewbNo: r['EWB No.'] || r['EWB No'] || r.EWB_NO || r.ewbNo || '',
      ewbDate: r['EWB Date.'] || r['EWB Date'] || r.ewbDate || '',
    })),
  };
}

export default {
  form: 'Eway_No_Upload_Offline',
  method: 'POST',
  runButtons: ['btn_Export_data_Sales', 'Generate_Eway_Bills'],
  exitButtons: ['btn_exit'],
  browseButtons: ['btn_brow'],
  browseAccept: '.xlsx,.xlsm,.xls,.json',
  onBrowseFile: parseEwayFile,
  lists: {},
  defaults: () => ({ txt_brows: '', Cbo_book: 'All' }),
  toParams: (s, btnName) => ({
    book: s.Cbo_book || 'All',
    action: btnName || 'Generate_Eway_Bills',
    ewayRows: s.__ewayRows || [],
  }),
  fallbackColumns: {
    JSM_VW_EWAY_UPLOAD: [
      { field: 'SL_NO', caption: 'SI.No', kind: 'N', dec: 0, total: false, len: 6 },
      { field: 'SUPPLY_TYPE', caption: 'Supply Type', kind: 'C', len: 11 },
      { field: 'DOC_NO', caption: 'Doc No.', kind: 'C', len: 12 },
      { field: 'DOC_DATE', caption: 'Doc.Date', kind: 'D', len: 10 },
      { field: 'PARTY_GSTIN', caption: 'Party GSTIN', kind: 'C', len: 16 },
      { field: 'VEHICLE_NO', caption: 'Vehicle No.', kind: 'C', len: 13 },
      { field: 'EWB_NO', caption: 'EWB No.', kind: 'C', len: 15 },
      { field: 'EWB_DATE', caption: 'EWB Date', kind: 'C', len: 11 },
      { field: 'EWB_STATUS', caption: 'EWB Status', kind: 'C', len: 12 },
    ],
  },
};
