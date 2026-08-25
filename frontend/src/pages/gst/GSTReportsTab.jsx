import React, { useState, useMemo, useRef } from 'react';
import useStore from '../../store/useStore';
import { ModalLoader } from '../../components/ui/loaders';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { downloadCsv } from '../../utils/reportExport';

const REPORT_TYPES = [
  { value: 'B2B', label: 'B2B' },
  { value: 'B2CL', label: 'B2CL' },
  { value: 'B2CS', label: 'B2CS' },
  { value: 'CDNR', label: 'CDNR' },
  { value: 'CDNU', label: 'CDNU' },
  { value: 'HSN', label: 'HSN' },
  { value: 'HSN_B2C', label: 'HSN B2C' },
  { value: 'DOCS', label: 'DOCS' },
  { value: 'EXP', label: 'EXP.' },
  { value: 'EXEMP', label: 'EXEMP' },
];

const GSTR_TYPES = [
  { value: 'GSTR1', label: 'GSTR-1 (Sales)' },
  { value: 'GSTR2', label: 'GSTR-2 (Purchases)' },
  { value: 'GSTR3B', label: 'GSTR-3B (Consolidated)' },
];

const GSTReportsTab = () => {
  const { sales, purchases, currentCompany } = useStore();

  // State
  const [month, setMonth] = useState('08');
  const [year, setYear] = useState('2026');
  const [fromDate, setFromDate] = useState('01/08/2026');
  const [toDate, setToDate] = useState('31/08/2026');
  const [activeTab, setActiveTab] = useState('B2B');
  const [gstType, setGstType] = useState('GSTR1');
  const [gstSlabWise, setGstSlabWise] = useState(true);
  const [hsnDescriptionWise, setHsnDescriptionWise] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const tableRef = useRef(null);

  // Parse dates from DD/MM/YYYY format
  const parseDateFromUI = (dateStr) => {
    const [d, m, y] = dateStr.split('/');
    return new Date(y, m - 1, d);
  };

  const formatDateToUI = (date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  // Generate report data based on tab and type
  const generateReportData = () => {
    setIsLoading(true);
    setError('');

    try {
      setTimeout(() => {
        const start = parseDateFromUI(fromDate);
        const end = parseDateFromUI(toDate);

        let reportData = [];

        if (gstType === 'GSTR1') {
          // Sales data
          reportData = sales
            .filter(s => {
              const sDate = new Date(s.date);
              return sDate >= start && sDate <= end;
            })
            .map((s, idx) => ({
              _key: idx,
              GSTIN_NO: s.customerId?.gstin || '',
              PARTY: s.customerId?.name || '',
              NCBILL_NO: s.invoiceNo || '',
              BILL_DATE: s.date ? new Date(s.date).toISOString().split('T')[0] : '',
              NET_TOT: Number(s.netAmount || 0).toFixed(2),
              STATE_NAME: s.customerId?.state || '',
              RVRS_YN: 'N',
              A_TAX_RATE: `${s.gstType === 'IGST' ? Number(s.igst) : (Number(s.cgst) + Number(s.sgst))}%`,
              INV_TYPE: s.type || 'REG',
              TAXABLE: Number(s.taxableAmount || 0).toFixed(2),
              CGST: Number(s.cgst || 0).toFixed(2),
              SGST: Number(s.sgst || 0).toFixed(2),
              IGST: Number(s.igst || 0).toFixed(2),
            }));
        } else if (gstType === 'GSTR2') {
          // Purchase data
          reportData = purchases
            .filter(p => {
              const pDate = new Date(p.date);
              return pDate >= start && pDate <= end;
            })
            .map((p, idx) => ({
              _key: idx,
              GSTIN_NO: p.supplierId?.gstin || '',
              PARTY: p.supplierId?.name || '',
              NCBILL_NO: p.supplierInvoiceNo || p.invoiceNo || '',
              BILL_DATE: p.date ? new Date(p.date).toISOString().split('T')[0] : '',
              NET_TOT: Number(p.netAmount || 0).toFixed(2),
              STATE_NAME: p.supplierId?.state || '',
              RVRS_YN: p.reverseCharge === 'Yes' ? 'Y' : 'N',
              A_TAX_RATE: `${p.gstType === 'IGST' ? Number(p.igst) : (Number(p.cgst) + Number(p.sgst))}%`,
              INV_TYPE: p.type || 'REG',
              TAXABLE: Number(p.taxableAmount || 0).toFixed(2),
              CGST: Number(p.cgst || 0).toFixed(2),
              SGST: Number(p.sgst || 0).toFixed(2),
              IGST: Number(p.igst || 0).toFixed(2),
            }));
        }

        // Filter by tab (report type)
        if (activeTab === 'B2B') {
          reportData = reportData.filter(r => r.INV_TYPE === 'REG');
        } else if (activeTab === 'B2CS') {
          reportData = reportData.filter(r => r.INV_TYPE === 'B2CS');
        }

        // Sort by slab if enabled
        if (gstSlabWise) {
          reportData.sort((a, b) => {
            const rateA = parseFloat(a.A_TAX_RATE);
            const rateB = parseFloat(b.A_TAX_RATE);
            return rateA - rateB;
          });
        }

        setRows(reportData);
      }, 500);
    } catch (err) {
      setError(`Error generating report: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadData = () => {
    generateReportData();
  };

  const handleDownloadExcel = () => {
    if (rows.length === 0) {
      setError('No data to export. Please load data first.');
      return;
    }

    setIsLoading(true);
    try {
      const headers = ['GSTIN_NO', 'PARTY', 'NCBILL_NO', 'BILL_DATE', 'NET_TOT', 'STATE_NAME', 'RVRS_YN', 'A_TAX_RATE', 'INV_TYPE', 'TAXABLE', 'CGST', 'SGST', 'IGST'];
      const csvRows = rows.map(r => [
        r.GSTIN_NO,
        r.PARTY,
        r.NCBILL_NO,
        r.BILL_DATE,
        r.NET_TOT,
        r.STATE_NAME,
        r.RVRS_YN,
        r.A_TAX_RATE,
        r.INV_TYPE,
        r.TAXABLE,
        r.CGST,
        r.SGST,
        r.IGST,
      ]);

      downloadCsv(`GSTR_${gstType}_${fromDate.replace(/\//g, '')}_to_${toDate.replace(/\//g, '')}.csv`, headers, csvRows);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#e8eef7] p-4 rounded-lg relative">
      {isLoading && <ModalLoader message="Generating GST Report…" />}

      {/* Top Controls */}
      <div className="bg-white border-2 border-gray-400 p-4 mb-4">
        {/* Row 1: Month and Date Range */}
        <div className="flex gap-4 items-center mb-4">
          <div>
            <label className="text-xs font-bold text-gray-700">Aug</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-400 px-2 py-1 text-sm font-bold"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1).padStart(2, '0')}>
                  {new Date(2026, i, 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs font-bold text-gray-700">From</label>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="border-2 border-gray-400 px-3 py-1 font-bold text-sm w-32 text-center"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">To</label>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="border-2 border-gray-400 px-3 py-1 font-bold text-sm w-32 text-center"
              />
            </div>
          </div>

          <div className="flex gap-3 ml-auto">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={gstSlabWise}
                onChange={(e) => setGstSlabWise(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-bold">Gst Slab Wise</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hsnDescriptionWise}
                onChange={(e) => setHsnDescriptionWise(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-bold">HsnDescriptionWise</span>
            </label>
          </div>

          <div className="flex gap-2 items-end ml-auto">
            <div>
              <label className="text-xs font-bold text-gray-700">Report Type</label>
              <select
                value={gstType}
                onChange={(e) => setGstType(e.target.value)}
                className="border-2 border-gray-400 px-3 py-1 font-bold text-sm"
              >
                {GSTR_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLoadData}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-1 rounded text-sm"
            >
              LoadData
            </button>
          </div>
        </div>

        {/* Report Type Tabs */}
        <div className="flex gap-1 border-b-2 border-gray-400">
          {REPORT_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setActiveTab(type.value)}
              className={`px-3 py-2 font-bold text-sm ${
                activeTab === type.value
                  ? 'bg-blue-600 text-white border-b-2 border-blue-800'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border-2 border-red-500 p-3 mb-4 flex gap-2 items-center">
          <AlertCircle size={16} className="text-red-600" />
          <span className="font-bold text-red-800">{error}</span>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white border-2 border-gray-400 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm font-mono border-collapse" ref={tableRef}>
            <thead className="sticky top-0 bg-gray-100 border-b-2 border-gray-400">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-left font-bold text-xs">GSTIN_NO</th>
                <th className="border border-gray-300 px-2 py-1 text-left font-bold text-xs">PARTY</th>
                <th className="border border-gray-300 px-2 py-1 text-left font-bold text-xs">NCBILL_NO</th>
                <th className="border border-gray-300 px-2 py-1 text-left font-bold text-xs">BILL_DATE</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">NET_TOT</th>
                <th className="border border-gray-300 px-2 py-1 text-left font-bold text-xs">STATE_NAME</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-bold text-xs">RVRS_YN</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">A_TAX_RATE</th>
                <th className="border border-gray-300 px-2 py-1 text-left font-bold text-xs">INV_TYPE</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">TAXABLE</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">CGST</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">SGST</th>
                <th className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">IGST</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="13" className="border border-gray-300 px-2 py-20 text-center text-gray-500 font-bold">
                    {isLoading ? 'Loading...' : 'No data loaded. Click LoadData to generate report.'}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row._key} className="hover:bg-blue-50 border-b border-gray-300">
                    <td className="border border-gray-300 px-2 py-1 text-xs">{row.GSTIN_NO}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{row.PARTY}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{row.NCBILL_NO}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{row.BILL_DATE}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">{row.NET_TOT}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{row.STATE_NAME}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-xs">{row.RVRS_YN}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">{row.A_TAX_RATE}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{row.INV_TYPE}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">{row.TAXABLE}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">{row.CGST}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">{row.SGST}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">{row.IGST}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex gap-3 mt-4 justify-end">
        <button
          onClick={handleDownloadExcel}
          disabled={rows.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold px-6 py-2 rounded flex items-center gap-2"
        >
          <Download size={16} />
          Generate Excel
        </button>
        <button
          onClick={handleLoadData}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Status Bar */}
      <div className="mt-2 text-xs text-gray-600 font-bold">
        {rows.length > 0 && (
          <span>Total Records: {rows.length} | Sum Amount: ₹{rows.reduce((sum, r) => sum + parseFloat(r.NET_TOT || 0), 0).toFixed(2)}</span>
        )}
      </div>
    </div>
  );
};

export default GSTReportsTab;
