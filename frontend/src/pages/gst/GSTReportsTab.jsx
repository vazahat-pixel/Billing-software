import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { Download, FileJson } from 'lucide-react';
import { downloadCsv } from '../../utils/reportExport';

const GSTReportsTab = () => {
  const { sales, purchases } = useStore();
  const [selectedMonth, setSelectedMonth] = useState('AUGUST');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [fromDate, setFromDate] = useState('01/04/2026');
  const [toDate, setToDate] = useState('25/08/2026');
  const [activeTab, setActiveTab] = useState('B2B');
  const [rows, setRows] = useState([
    {
      id: 'INV-2026-27-0004',
      date: '2026-08-07',
      gstin: '24AAAAAA0009AIZ5',
      gstinPos: '24AAAAAA0009AIZ5',
      taxable: 17000,
      grossTotal: 17850.5,
    }
  ]);

  const TABS = ['B2B', 'B2C LARGE', 'B2C SMALL', 'HSN'];
  const TAB_COUNTS = { 'B2B': 1, 'B2C LARGE': 0, 'B2C SMALL': 1, 'HSN': 2 };

  const handleExportCsv = () => {
    const headers = ['Reference', 'Date', 'GSTIN', 'Taxable', 'Gross Total'];
    const csvRows = rows.map(r => [r.id, r.date, r.gstin, r.taxable, r.grossTotal]);
    downloadCsv(`GSTR1_${fromDate}_to_${toDate}.csv`, headers, csvRows);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black italic text-gray-900 mb-2">GSTR-1 Registry</h1>
        <p className="text-sm text-gray-500">
          2026-08 · TAXABLE ₹1,91,650 · GST ₹9,582.5 · 11 INV
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center justify-between mb-8">
        <div className="flex gap-3 items-end">
          {/* Month/Year Selector */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-blue-100 text-blue-900 font-bold px-4 py-2 rounded border-2 border-blue-300"
            >
              {['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <span className="text-2xl text-gray-400">,</span>
          <span className="text-2xl font-bold text-gray-700">{selectedYear}</span>

          {/* Date Range */}
          <div className="flex gap-2 ml-4 items-end">
            <div>
              <input
                type="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border-2 border-gray-300 px-3 py-1 font-mono text-sm bg-white"
                placeholder="DD/MM/YYYY"
              />
            </div>
            <span className="text-gray-400">to</span>
            <div>
              <input
                type="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border-2 border-gray-300 px-3 py-1 font-mono text-sm bg-white"
                placeholder="DD/MM/YYYY"
              />
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleExportCsv}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2"
          >
            <Download size={18} />
            EXPORT EXCEL (.CSV)
          </button>
          <button
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2"
          >
            <FileJson size={18} />
            JSON (GOVT)
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 border-2 border-gray-300'
                : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            {tab} ({TAB_COUNTS[tab]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                REFERENCE & DATE
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                COUNTERPARTY
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                GSTIN / POS
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                TAXABLE VALUE
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                GROSS TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">{row.id}</div>
                  <div className="text-sm text-gray-500">{row.date}</div>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  —
                </td>
                <td className="px-6 py-4 font-mono text-sm text-gray-900">
                  {row.gstinPos}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-gray-900">
                  ₹ {row.taxable.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-gray-900">
                  ₹ {row.grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GSTReportsTab;
