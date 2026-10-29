import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../ui/Modal';
import { masterDataApi } from '../../api/masters.api';
import { downloadMasterTemplate } from '../../utils/excelTemplateGenerator';
import { toast } from '../../store/useToastStore';
import useStore from '../../store/useStore';
import JsmImportWizard from './JsmImportWizard';
import {
  chunkBillRows, mergeBillPreviews, mergeBillResults,
  chunkRows, mergeMasterPreviews, mergeMasterResults, safeHeaderKey,
} from './billImportChunks';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Download,
  RefreshCw,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

function BILL_FIELDS(partyLabel) {
  return [
    { key: 'billNo', label: 'Bill No *', required: true },
    { key: 'date', label: 'Bill Date * (dd/mm/yyyy)', required: true },
    { key: 'party', label: `${partyLabel} Name *`, required: true },
    { key: 'item', label: 'Item Name *', required: true },
    { key: 'pcs', label: 'Pcs' },
    { key: 'mts', label: 'Mts / Qty' },
    { key: 'rate', label: 'Rate' },
    { key: 'amount', label: 'Amount (blank = Mts x Rate)' },
    { key: 'gstPer', label: 'GST %' },
    { key: 'hsn', label: 'HSN Code' },
  ];
}

const ENTITY_CONFIGS = {
  item: {
    label: 'Items Master',
    description: 'Products, fabrics, qualities, rates, HSN, and opening stock',
    fields: [
      { key: 'name', label: 'Item Name *', required: true },
      { key: 'itemCode', label: 'Item Code / SKU' },
      { key: 'category', label: 'Category (Grey/Finished/Yarn/Others)' },
      { key: 'hsnCode', label: 'HSN Code' },
      { key: 'gstRate', label: 'GST Rate (%)' },
      { key: 'unit', label: 'Unit (MTRS/PCS)' },
      { key: 'purchaseRate', label: 'Purchase Rate' },
      { key: 'salesRate', label: 'Sales Rate' },
      { key: 'openingStock', label: 'Opening Stock (Mtrs)' },
      { key: 'openingPcs', label: 'Opening Pieces' },
      { key: 'openingRate', label: 'Opening Rate' },
    ],
  },
  party: {
    label: 'Parties / Accounts',
    description: 'Customers, suppliers, job workers, GSTIN, and opening balances',
    fields: [
      { key: 'name', label: 'Party Name *', required: true },
      { key: 'type', label: 'Type (Customer/Supplier/Both)' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'pan', label: 'PAN' },
      { key: 'mobile', label: 'Mobile Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'address', label: 'Address' },
      { key: 'address2', label: 'Address 2' },
      { key: 'address3', label: 'Address 3' },
      { key: 'city', label: 'City / Station' },
      { key: 'pincode', label: 'Pin Code' },
      { key: 'state', label: 'State' },
      { key: 'stateCode', label: 'State Code' },
      { key: 'phoneO', label: 'Phone (Office)' },
      { key: 'phoneR', label: 'Phone (Residence)' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'dueDays', label: 'Due / Credit Days' },
      { key: 'openingBalance', label: 'Opening Balance' },
      { key: 'openingBalanceType', label: 'Dr / Cr' },
      { key: 'creditLimit', label: 'Credit Limit' },
    ],
  },
  openingStock: {
    label: 'Opening Stock Lots',
    description: 'Existing inventory lot numbers, godowns/warehouses, and meters',
    fields: [
      { key: 'itemName', label: 'Item Name *', required: true },
      { key: 'lotNo', label: 'Lot No' },
      { key: 'warehouse', label: 'Warehouse / Godown' },
      { key: 'meters', label: 'Meters *', required: true },
      { key: 'pcs', label: 'Pieces' },
      { key: 'rate', label: 'Rate' },
    ],
  },
  salesBill: {
    label: 'Old Sales Bills',
    description: 'Past sales invoices, one row per bill line; stock, GST and outstanding are built',
    bill: true,
    fields: BILL_FIELDS('Customer'),
  },
  purchaseBill: {
    label: 'Old Purchase Bills',
    description: 'Past purchase bills, one row per bill line; stock, GST and outstanding are built',
    bill: true,
    fields: BILL_FIELDS('Supplier'),
  },
};

const isBillEntity = (entity) => !!ENTITY_CONFIGS[entity]?.bill;

// Old bills can be thousands of rows: send them in batches of whole bills (request size / time limits).
async function previewRows(entity, rows, columnMappings) {
  if (!isBillEntity(entity)) {
    const chunks = chunkRows(rows, 1000);
    const masterParts = [];
    for (const chunk of chunks) {
      masterParts.push(await masterDataApi.previewImport({ entity, rows: chunk, columnMappings }));
    }
    return mergeMasterPreviews(masterParts, chunks.map((c) => c.length));
  }
  const parts = [];
  for (const chunk of chunkBillRows(rows, columnMappings)) {
    parts.push(await masterDataApi.previewImport({ entity, rows: chunk, columnMappings }));
  }
  return mergeBillPreviews(parts);
}

async function executeRows(entity, rows, columnMappings, onProgress) {
  if (!isBillEntity(entity)) {
    const batches = chunkRows(rows, 150);
    const masterParts = [];
    for (let i = 0; i < batches.length; i += 1) {
      onProgress?.(i + 1, batches.length);
      masterParts.push(await masterDataApi.executeImport({ entity, rows: batches[i], columnMappings }));
    }
    return mergeMasterResults(masterParts, batches.map((c) => c.length));
  }
  const chunks = chunkBillRows(rows, columnMappings);
  const parts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.(i + 1, chunks.length);
    parts.push(await masterDataApi.executeImport({ entity, rows: chunks[i], columnMappings }));
  }
  return mergeBillResults(parts);
}

const SHEET_HINTS = {
  party: /part|account|customer|supplier|ledger|debtor|creditor/i,
  item: /item|product|fabric|quality|goods/i,
  openingStock: /opening|stock|lot/i,
  salesBill: /sale|invoice/i,
  purchaseBill: /purch/i,
};
const SKIP_SHEETS = /instruction|read ?me|guide|help|note/i;

/** The sheet to open first: the one named like the chosen data type, else the first real data sheet. */
function pickSheetFor(entity, names) {
  const hint = SHEET_HINTS[entity];
  const named = hint ? names.find((n) => hint.test(n) && !SKIP_SHEETS.test(n)) : null;
  return named || names.find((n) => !SKIP_SHEETS.test(n)) || names[0];
}

export default function DataImportModal({ isOpen, onClose, initialEntity = 'auto' }) {
  const { fetchItems, fetchParties } = useStore();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping & Preview, 3: Complete
  const [selectedEntity, setSelectedEntity] = useState(initialEntity);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [workbookData, setWorkbookData] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [progress, setProgress] = useState('');
  // what the user asked for in step 1 ('auto' = detect for every sheet); selectedEntity is what is shown now
  const [entityChoice, setEntityChoice] = useState(initialEntity);
  const [importedSheets, setImportedSheets] = useState([]);
  const [jsmOpen, setJsmOpen] = useState(false);

  const currentConfig = ENTITY_CONFIGS[selectedEntity] || ENTITY_CONFIGS.item;

  const resetAll = () => {
    setStep(1);
    setSelectedEntity(initialEntity);
    setEntityChoice(initialEntity);
    setImportedSheets([]);
    setFileName('');
    setSheets([]);
    setActiveSheet('');
    setWorkbookData(null);
    setRawHeaders([]);
    setRawRows([]);
    setColumnMappings({});
    setPreviewData(null);
    setIsProcessing(false);
    setImportResult(null);
  };

  const handleClose = () => {
    resetAll();
    onClose?.();
  };

  // Handle file drop / upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbookData(wb);
        setSheets(wb.SheetNames);

        // The sheet named like the chosen data type (Parties / Items / Opening Stock Lots...), else the first data sheet
        const sheetNameToUse = pickSheetFor(entityChoice, wb.SheetNames);
        setActiveSheet(sheetNameToUse);
        setImportedSheets([]);
        loadSheetContent(wb, sheetNameToUse, entityChoice);
      } catch (err) {
        toast.error('Failed to parse Excel file: ' + err.message);
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Parses chosen sheet and triggers mapping analysis
  const loadSheetContent = async (wb, sheetName, currentEntity) => {
    setIsProcessing(true);
    try {
      const ws = wb.Sheets[sheetName];
      // headings with a "." (Mobile No., Op. Bal.) would be stripped by the server's input filter: send them dot-free
      const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }).map((r) => (
        Object.fromEntries(Object.entries(r).map(([k, v]) => [safeHeaderKey(k), v]))
      ));

      if (!jsonData || jsonData.length === 0) {
        toast.error(`Sheet "${sheetName}" is empty.`);
        setIsProcessing(false);
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setRawHeaders(headers);
      setRawRows(jsonData);

      // A sheet named like its data (Sales Bills, Purchase Bills, Opening Stock Lots, Parties, Items) tells the type; else the headings do
      const byName = currentEntity === 'auto'
        ? ['salesBill', 'purchaseBill', 'openingStock', 'party', 'item'].find((k) => SHEET_HINTS[k].test(sheetName) && !SKIP_SHEETS.test(sheetName))
        : null;
      if (byName) { currentEntity = byName; setSelectedEntity(byName); }

      // Call backend to auto-suggest mappings
      const res = await masterDataApi.suggestMappings({
        headers,
        entity: currentEntity,
      });

      const detected = res.detectedEntity || 'item';
      if (currentEntity === 'auto') {
        setSelectedEntity(detected);
      }
      setColumnMappings(res.mappings || {});

      // Automatically generate preview
      const previewRes = await previewRows(currentEntity === 'auto' ? detected : currentEntity, jsonData, res.mappings || {});
      setPreviewData(previewRes);

      setStep(2);
    } catch (err) {
      toast.error('Error analyzing columns: ' + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSheetChange = (sheetName) => {
    if (!workbookData) return;
    setActiveSheet(sheetName);
    loadSheetContent(workbookData, sheetName, entityChoice);
  };

  const handleEntityChange = async (newEntity) => {
    setSelectedEntity(newEntity);
    setEntityChoice(newEntity);
    if (rawHeaders.length > 0) {
      setIsProcessing(true);
      try {
        const res = await masterDataApi.suggestMappings({
          headers: rawHeaders,
          entity: newEntity,
        });
        setColumnMappings(res.mappings || {});

        const previewRes = await previewRows(newEntity, rawRows, res.mappings || {});
        setPreviewData(previewRes);
      } catch (err) {
        toast.error(err.message || 'Error updating mappings');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleMappingChange = async (header, targetField) => {
    const updated = { ...columnMappings, [header]: targetField };
    setColumnMappings(updated);

    // Refresh live preview
    try {
      const previewRes = await previewRows(selectedEntity, rawRows, updated);
      setPreviewData(previewRes);
    } catch (err) {
      // Ignore preview errors during active editing
    }
  };

  // Run final import
  const handleExecuteImport = async () => {
    setIsProcessing(true);
    try {
      const result = await executeRows(selectedEntity, rawRows, columnMappings, (n, total) => setProgress(total > 1 ? `${n}/${total}` : ''));
      setImportResult(result);
      setImportedSheets((prev) => (prev.includes(activeSheet) ? prev : [...prev, activeSheet]));
      setStep(3);

      // Trigger store refreshes
      fetchItems?.();
      if (currentConfig.bill) useStore.getState().refreshAllData?.().catch(() => {});
      fetchParties?.();

      toast.success(
        `Import complete! ${result.created} created, ${result.skipped} skipped.`
      );
    } catch (err) {
      toast.error('Import failed: ' + (err.message || err));
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Data Import & Migration Assistant"
      className="max-w-4xl"
    >
      <div className="p-6 flex flex-col gap-6 text-slate-800 flex-1 min-h-0 overflow-y-auto">
        {/* Progress Stepper */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </div>
            <span className={`text-xs font-semibold ${step >= 1 ? 'text-blue-900' : 'text-slate-400'}`}>
              Upload & Choose
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </div>
            <span className={`text-xs font-semibold ${step >= 2 ? 'text-blue-900' : 'text-slate-400'}`}>
              Review & Match Fields
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <div className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </div>
            <span className={`text-xs font-semibold ${step === 3 ? 'text-emerald-900' : 'text-slate-400'}`}>
              Done
            </span>
          </div>
        </div>

        {/* STEP 1: Upload File & Select Entity */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-lg p-4">
              <div>
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Coming from JSM? Bring everything in one click</h4>
                <p className="text-[11px] text-emerald-900/80 mt-0.5">All masters, bills, mill and job work, receipts and payments, ledgers and stock of every year, checked against JSM. Runs in the Desktop app on the computer where JSM is installed.</p>
              </div>
              <button type="button" onClick={() => setJsmOpen(true)} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded shadow-sm shrink-0 ml-4">Import from JSM</button>
            </div>
            <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-blue-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                    New to Billing Software? Download Standard Template
                  </h4>
                  <p className="text-[11px] text-blue-800/80 mt-0.5">
                    Includes pre-made clean sheets for Parties, Items, and Opening Stock with example data.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadMasterTemplate}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template (.xlsx)
              </button>
            </div>

            {/* Entity Target Selection */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                What data does this file contain?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(ENTITY_CONFIGS).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setSelectedEntity(key); setEntityChoice(key); }}
                    className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                      selectedEntity === key
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{config.label}</span>
                        {selectedEntity === key && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        {config.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition group"
            >
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-slate-800">
                  Click to browse or drag & drop your Excel / CSV file
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Supports .xlsx, .xls, and .csv exports from Tally, Busy, Vyapar, or Excel.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Mapping & Live Preview */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            {/* Sheet & Entity Switcher Bar */}
            <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">File:</span>
                <span className="text-[11px] font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border">
                  {fileName}
                </span>

                {sheets.length > 1 && (
                  <>
                    <span className="text-[11px] font-bold text-slate-600 ml-2">Sheet:</span>
                    <select
                      value={activeSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="text-[11px] bg-white border border-slate-300 rounded px-2 py-0.5 font-bold"
                    >
                      {sheets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">Import As:</span>
                <select
                  value={selectedEntity}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className="text-[11px] bg-white border border-blue-400 rounded px-2 py-0.5 font-bold text-blue-900"
                >
                  <option value="item">Items Master</option>
                  <option value="party">Parties Master</option>
                  <option value="openingStock">Opening Stock Lots</option>
                  <option value="salesBill">Old Sales Bills</option>
                  <option value="purchaseBill">Old Purchase Bills</option>
                </select>
              </div>
            </div>

            {/* Validation Metrics Cards */}
            {previewData && (
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Rows</div>
                  <div className="text-base font-black text-slate-800">{previewData.totalRows}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Ready to Import</div>
                  <div className="text-base font-black text-emerald-700">{previewData.validRows}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-center">
                  <div className="text-[10px] uppercase font-bold text-amber-700">Duplicates (Skip)</div>
                  <div className="text-base font-black text-amber-700">{previewData.duplicateRows}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded p-2.5 text-center">
                  <div className="text-[10px] uppercase font-bold text-rose-700">Errors</div>
                  <div className="text-base font-black text-rose-700">{previewData.invalidRows}</div>
                </div>
              </div>
            )}

            {/* Interactive Column Mapping Accordion / Table */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Field Mappings (Excel Column ➔ Billing Software Field)
                </h4>
                <span className="text-[10px] text-slate-400">
                  Verify or change matching if needed
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto bg-white divide-y">
                {rawHeaders.map((header) => {
                  const targetField = columnMappings[header] || '';
                  const isMatched = !!targetField;
                  return (
                    <div
                      key={header}
                      className={`flex items-center justify-between px-3 py-1.5 text-[11px] ${
                        isMatched ? 'bg-white' : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono truncate max-w-xs font-semibold text-slate-800">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{header}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mx-2" />
                      <select
                        value={targetField}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className={`text-[11px] border rounded px-2 py-1 font-medium w-64 ${
                          isMatched
                            ? 'border-emerald-500 bg-emerald-50/30 text-emerald-950'
                            : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        <option value="">-- Ignore / Skip Column --</option>
                        {currentConfig.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {currentConfig.bill && previewData && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] text-slate-700 bg-blue-50 border border-blue-200 rounded p-2">
                  <b>{previewData.bills}</b> bills found in <b>{previewData.totalRows}</b> rows.
                  {' '}{previewData.alreadyImported > 0 && <><b>{previewData.alreadyImported}</b> already in the software (will be skipped). </>}
                  {previewData.newParties?.length > 0 && <>New parties to create: <b>{previewData.newParties.length}</b>. </>}
                  {previewData.newItems?.length > 0 && <>New items to create: <b>{previewData.newItems.length}</b>.</>}
                </div>
                {previewData.errors?.length > 0 && (
                  <div className="border border-rose-200 bg-rose-50 rounded p-2 max-h-24 overflow-y-auto text-[10px] text-rose-700">
                    {previewData.errors.map((e, idx) => <div key={idx}>Row {e.row}: {e.error}</div>)}
                  </div>
                )}
                {previewData.sampleBills?.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-40 bg-white">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b text-slate-600">
                          <th className="p-2 font-bold">Bill No</th>
                          <th className="p-2 font-bold">Date</th>
                          <th className="p-2 font-bold">Party</th>
                          <th className="p-2 font-bold text-right">Lines</th>
                          <th className="p-2 font-bold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-700">
                        {previewData.sampleBills.map((b, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-mono">{b.billNo}</td>
                            <td className="p-2">{new Date(b.date).toLocaleDateString('en-GB')}</td>
                            <td className="p-2 font-semibold text-slate-900">{b.party}</td>
                            <td className="p-2 text-right">{b.lines}</td>
                            <td className="p-2 text-right font-bold">{Number(b.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!currentConfig.bill && previewData?.errors?.length > 0 && (
              <div className="border border-rose-200 bg-rose-50 rounded p-2 max-h-28 overflow-y-auto text-[10px] text-rose-700">
                <div className="font-bold uppercase mb-0.5">Rows that will not be imported ({previewData.invalidRows})</div>
                {previewData.errors.map((e, idx) => <div key={idx}>Row {e.row}: {e.message || e.error}</div>)}
              </div>
            )}
            {!currentConfig.bill && previewData?.warnings?.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded p-2 max-h-24 overflow-y-auto text-[10px] text-amber-800">
                <div className="font-bold uppercase mb-0.5">Please check</div>
                {previewData.warnings.map((w, idx) => (
                  <div key={idx}>{w.message} - {w.count} row{w.count === 1 ? '' : 's'}{w.rows?.length ? ` (e.g. row ${w.rows.join(', ')})` : ''}</div>
                ))}
              </div>
            )}

            {/* Live Data Preview */}
            {!currentConfig.bill && previewData?.sampleRows?.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Sample Data Preview (First {previewData.sampleRows.length} Rows)
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-40 bg-white">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b text-slate-600">
                        <th className="p-2 font-bold">Status</th>
                        <th className="p-2 font-bold">Name</th>
                        {selectedEntity === 'party' && (
                          <>
                            <th className="p-2 font-bold">Type</th>
                            <th className="p-2 font-bold">GSTIN</th>
                            <th className="p-2 font-bold">City</th>
                            <th className="p-2 font-bold">Opening Bal</th>
                          </>
                        )}
                        {selectedEntity === 'item' && (
                          <>
                            <th className="p-2 font-bold">Category</th>
                            <th className="p-2 font-bold">HSN</th>
                            <th className="p-2 font-bold">GST %</th>
                            <th className="p-2 font-bold">Op. Stock (Mtrs)</th>
                          </>
                        )}
                        {selectedEntity === 'openingStock' && (
                          <>
                            <th className="p-2 font-bold">Lot No</th>
                            <th className="p-2 font-bold">Warehouse</th>
                            <th className="p-2 font-bold">Meters</th>
                            <th className="p-2 font-bold">Rate</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {previewData.sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            {row._status === 'DUPLICATE_SKIP' ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">
                                Duplicate
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                                Ready
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-semibold text-slate-900">{row.name || row.itemName}</td>
                          {selectedEntity === 'party' && (
                            <>
                              <td className="p-2">{row.type}</td>
                              <td className="p-2 font-mono">{row.gstin || '-'}</td>
                              <td className="p-2">{row.city || '-'}</td>
                              <td className="p-2 font-bold">₹{row.openingBalance} ({row.openingBalanceType})</td>
                            </>
                          )}
                          {selectedEntity === 'item' && (
                            <>
                              <td className="p-2">{row.category}</td>
                              <td className="p-2 font-mono">{row.hsnCode || '-'}</td>
                              <td className="p-2">{row.gstRate}%</td>
                              <td className="p-2 font-bold">{row.openingStock} {row.unit}</td>
                            </>
                          )}
                          {selectedEntity === 'openingStock' && (
                            <>
                              <td className="p-2 font-mono">{row.lotNo || 'Auto'}</td>
                              <td className="p-2">{row.warehouse || 'Default'}</td>
                              <td className="p-2 font-bold">{row.meters} Mtrs</td>
                              <td className="p-2">₹{row.rate}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Bar (stays visible while the rest scrolls) */}
            <div className="flex items-center justify-between pt-3 pb-6 -mb-6 -mx-6 px-6 border-t sticky -bottom-6 bg-[var(--bg-card,#fff)] z-10">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded"
              >
                Back to Upload
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || !previewData?.validRows}
                className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded uppercase tracking-wider shadow"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Importing {currentConfig.bill ? 'Bills' : 'Records'}... {progress}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Import {previewData?.validRows || 0} {currentConfig.bill ? 'Bills' : 'Records'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Complete / Results Report */}
        {step === 3 && importResult && (
          <div className="flex flex-col items-center justify-center text-center p-6 gap-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {importResult.failed > 0 ? 'Import finished - some rows were not imported' : 'Data Import Completed Successfully!'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Your legacy data has been validated and injected into the Billing Software master database.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-md">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Created</span>
                <div className="text-xl font-black text-emerald-800">{importResult.created}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-700">Skipped (Existed)</span>
                <div className="text-xl font-black text-amber-800">{importResult.skipped}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-600">Failed / Errors</span>
                <div className="text-xl font-black text-slate-700">{importResult.failed}</div>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="w-full max-w-md border border-rose-200 bg-rose-50 rounded-lg p-3 text-left max-h-32 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase text-rose-800 mb-1">
                  Rows with errors ({importResult.errors.length}):
                </div>
                <ul className="text-[10px] text-rose-700 space-y-0.5 list-disc pl-4">
                  {importResult.errors.map((e, idx) => (
                    <li key={idx}>
                      {e.row ? `Row ${e.row}` : `Bill ${e.bill} (${e.party})`}: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sheets.filter((n) => !SKIP_SHEETS.test(n) && !importedSheets.includes(n)).length > 0 && (
              <div className="w-full max-w-md text-left border border-blue-200 bg-blue-50 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase text-blue-900 mb-1.5">More sheets in this file (import in this order: Parties, Items, Opening Stock)</div>
                <div className="flex flex-wrap gap-2">
                  {sheets.filter((n) => !SKIP_SHEETS.test(n) && !importedSheets.includes(n)).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleSheetChange(n)}
                      className="px-3 py-1.5 bg-white border border-blue-400 text-blue-900 text-[11px] font-bold rounded hover:bg-blue-100"
                    >
                      Import sheet: {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetAll}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-50"
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded uppercase tracking-wider"
              >
                Done & View Masters
              </button>
            </div>
          </div>
        )}
      </div>
      <JsmImportWizard isOpen={jsmOpen} onClose={() => setJsmOpen(false)} />
    </Modal>
  );
}
