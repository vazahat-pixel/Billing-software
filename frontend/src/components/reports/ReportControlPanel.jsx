import React, { useState } from 'react';
import { Search, Calendar, Filter, ChevronDown, RotateCcw, Printer, FileSpreadsheet } from 'lucide-react';

const GROUP_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'party', label: 'Party' },
  { value: 'gstin', label: 'GSTIN' },
  { value: 'book', label: 'Book' },
  { value: 'gstRate', label: 'GST Rate' },
  { value: 'state', label: 'State' },
  { value: 'date', label: 'Date' },
  { value: 'month', label: 'Month' },
  { value: 'taxType', label: 'Tax Type' },
  { value: 'item', label: 'Item' },
];

const GST_RATES = ['', '0', '0.25', '1.5', '3', '5', '12', '18', '28'];
const STATES = [
  '', '01-Jammu & Kashmir', '02-Himachal Pradesh', '03-Punjab', '04-Chandigarh',
  '05-Uttarakhand', '06-Haryana', '07-Delhi', '08-Rajasthan', '09-Uttar Pradesh',
  '10-Bihar', '11-Sikkim', '12-Arunachal Pradesh', '13-Nagaland', '14-Manipur',
  '15-Mizoram', '16-Tripura', '17-Meghalaya', '18-Assam', '19-West Bengal',
  '20-Jharkhand', '21-Odisha', '22-Chhattisgarh', '23-Madhya Pradesh', '24-Gujarat',
  '25-Daman & Diu', '26-Dadra & Nagar Haveli', '27-Maharashtra', '28-Andhra Pradesh (Old)',
  '29-Karnataka', '30-Goa', '31-Lakshadweep', '32-Kerala', '33-Tamil Nadu',
  '34-Puducherry', '35-Andaman & Nicobar', '36-Telangana', '37-Andhra Pradesh', '38-Ladakh',
];

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const lastOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

export default function ReportControlPanel({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  onPrint,
  onExcel,
  loading = false,
  showParty = true,
  showGstin = true,
  showBook = true,
  showGstRate = true,
  showState = true,
  showGroupBy = true,
  showMode = true,
}) {
  const [expanded, setExpanded] = useState(true);

  const update = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    if (onReset) onReset();
    else onFilterChange({
      fromDate: firstOfMonth(),
      toDate: lastOfMonth(),
      partyId: '',
      gstin: '',
      bookId: '',
      gstRate: '',
      state: '',
      groupBy1: '',
      groupBy2: '',
      mode: 'detail',
      partyName: '',
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-4 overflow-hidden">
      {/* Header bar with title + prominent Generate & Action buttons right here */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none text-slate-800 hover:text-slate-900"
          onClick={() => setExpanded(!expanded)}
        >
          <Filter size={15} className="text-indigo-600" />
          <span className="text-xs font-black uppercase tracking-wider">Report Filters & Options</span>
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {/* ALWAYS VISIBLE ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          {showMode && (
            <div className="flex border border-slate-200 rounded-xl bg-white p-0.5">
              <button
                type="button"
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  (filters.mode || 'detail') === 'summary'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                onClick={() => update('mode', 'summary')}
              >
                Summary
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  (filters.mode || 'detail') === 'detail'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                onClick={() => update('mode', 'detail')}
              >
                Detail
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Search size={14} />
            {loading ? 'Generating...' : 'Generate Report'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset
          </button>

          {onExcel && (
            <button
              type="button"
              onClick={onExcel}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={13} />
              Excel
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              Print
            </button>
          )}
        </div>
      </div>

      {/* Expandable filter body */}
      {expanded && (
        <div className="p-4 bg-white flex flex-col gap-3">
          {/* Grid layout for filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* From Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} /> From Date
              </label>
              <input
                type="date"
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                value={filters.fromDate || firstOfMonth()}
                onChange={(e) => update('fromDate', e.target.value)}
              />
            </div>

            {/* To Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} /> To Date
              </label>
              <input
                type="date"
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                value={filters.toDate || lastOfMonth()}
                onChange={(e) => update('toDate', e.target.value)}
              />
            </div>

            {/* GSTIN */}
            {showGstin && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GSTIN</label>
                <input
                  type="text"
                  placeholder="Filter by GSTIN..."
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-blue-500"
                  value={filters.gstin || ''}
                  onChange={(e) => update('gstin', e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </div>
            )}

            {/* Party Name */}
            {showParty && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party</label>
                <input
                  type="text"
                  placeholder="Filter by party name..."
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                  value={filters.partyName || ''}
                  onChange={(e) => update('partyName', e.target.value)}
                />
              </div>
            )}

            {/* GST Rate */}
            {showGstRate && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GST Rate</label>
                <select
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                  value={filters.gstRate ?? ''}
                  onChange={(e) => update('gstRate', e.target.value)}
                >
                  <option value="">All Rates</option>
                  {GST_RATES.filter(Boolean).map((r) => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </div>
            )}

            {/* State */}
            {showState && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">State</label>
                <select
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                  value={filters.state || ''}
                  onChange={(e) => update('state', e.target.value)}
                >
                  <option value="">All States</option>
                  {STATES.filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Book */}
            {showBook && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Book</label>
                <input
                  type="text"
                  placeholder="Book ID..."
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                  value={filters.bookId || ''}
                  onChange={(e) => update('bookId', e.target.value)}
                />
              </div>
            )}

            {/* Group By 1 */}
            {showGroupBy && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group By 1</label>
                <select
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                  value={filters.groupBy1 || ''}
                  onChange={(e) => update('groupBy1', e.target.value)}
                >
                  {GROUP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Group By 2 */}
            {showGroupBy && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group By 2</label>
                <select
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500 disabled:opacity-50"
                  value={filters.groupBy2 || ''}
                  onChange={(e) => update('groupBy2', e.target.value)}
                  disabled={!filters.groupBy1}
                >
                  <option value="">None</option>
                  {GROUP_OPTIONS.filter((o) => o.value && o.value !== filters.groupBy1).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
