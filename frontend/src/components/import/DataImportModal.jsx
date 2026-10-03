import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../ui/Modal';
import { masterDataApi } from '../../api/masters.api';
import { downloadMasterTemplate } from '../../utils/excelTemplateGenerator';
import { toast } from '../../store/useToastStore';
import useStore from '../../store/useStore';
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
      { key: 'city', label: 'City / Station' },
      { key: 'state', label: 'State' },
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
};

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

  const currentConfig = ENTITY_CONFIGS[selectedEntity] || ENTITY_CONFIGS.item;

  const resetAll = () => {
    setStep(1);
    setSelectedEntity(initialEntity);
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

        // Pick first sheet or matching sheet
        const sheetNameToUse = wb.SheetNames[0];
        setActiveSheet(sheetNameToUse);
        loadSheetContent(wb, sheetNameToUse, selectedEntity);
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
      const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        toast.error(`Sheet "${sheetName}" is empty.`);
        setIsProcessing(false);
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setRawHeaders(headers);
      setRawRows(jsonData);

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
      const previewRes = await masterDataApi.previewImport({
        entity: currentEntity === 'auto' ? detected : currentEntity,
        rows: jsonData,
        columnMappings: res.mappings || {},
      });
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
    loadSheetContent(workbookData, sheetName, selectedEntity);
  };

  const handleEntityChange = async (newEntity) => {
    setSelectedEntity(newEntity);
    if (rawHeaders.length > 0) {
      setIsProcessing(true);
      try {
        const res = await masterDataApi.suggestMappings({
          headers: rawHeaders,
          entity: newEntity,
        });
        setColumnMappings(res.mappings || {});

        const previewRes = await masterDataApi.previewImport({
          entity: newEntity,
          rows: rawRows,
          columnMappings: res.mappings || {},
        });
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
      const previewRes = await masterDataApi.previewImport({
        entity: selectedEntity,
        rows: rawRows,
        columnMappings: updated,
      });
      setPreviewData(previewRes);
    } catch (err) {
      // Ignore preview errors during active editing
    }
  };

  // Run final import
  const handleExecuteImport = async () => {
    setIsProcessing(true);
    try {
      const result = await masterDataApi.executeImport({
        entity: selectedEntity,
        rows: rawRows,
        columnMappings,
      });
      setImportResult(result);
      setStep(3);

      // Trigger store refreshes
      fetchItems?.();
      fetchParties?.();

      toast.success(
        `Import complete! ${result.created} created, ${result.skipped} skipped.`
      );
    } catch (err) {
      toast.error('Import failed: ' + (err.message || err));
    } finally {
      setIsProcessing(false);
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
      <div className="p-6 flex flex-col gap-6 text-slate-800">
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
                    onClick={() => setSelectedEntity(key)}
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

            {/* Live Data Preview */}
            {previewData?.sampleRows?.length > 0 && (
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

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t">
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
                    Importing Records...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Import {previewData?.validRows || 0} Records
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
                Data Import Completed Successfully!
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
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
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
    </Modal>
  );
}
