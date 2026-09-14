import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/ui/Modal';
import { stage4Api } from '../../api/stage4.api';
import { salesApi } from '../../api/sales.api';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { exportTableToExcel } from '../../utils/reportExport';
import {
  Truck, Calendar, Download, RefreshCw, Search, Plus,
  FileSpreadsheet, CheckCircle2, AlertTriangle, Printer,
  FileText, ExternalLink
} from 'lucide-react';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');

export default function EWayBillHub({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [ewayList, setEwayList] = useState([]);
  const [search, setSearch] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Form for generating new E-Way Bill
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [distanceKm, setDistanceKm] = useState('50');
  const [submitting, setSubmitting] = useState(false);

  const fetchEwayList = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const data = await stage4Api.ewayList();
      setEwayList(Array.isArray(data) ? data : []);
    } catch (err) {
      notifyError(err, 'Failed to fetch E-Way Bills');
      setEwayList([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  const loadEligibleSales = useCallback(async () => {
    try {
      const res = await salesApi.list({ limit: 50 });
      const list = res?.sales || res?.data || (Array.isArray(res) ? res : []);
      // Sales over 50,000 threshold or all recent sales
      setSalesInvoices(list);
    } catch (err) {
      console.warn('Failed to load sales for eway generation', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEwayList();
      loadEligibleSales();
    }
  }, [isOpen, fetchEwayList, loadEligibleSales]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedSaleId) return toast.error('Please select an invoice');
    setSubmitting(true);
    try {
      await stage4Api.ewayGenerate({
        salesId: selectedSaleId,
        transporterName,
        transporterId,
        vehicleNo,
        distanceKm: Number(distanceKm) || 50,
      });
      toast.success('E-Way Bill generated successfully');
      setShowGenerateModal(false);
      setSelectedSaleId('');
      setVehicleNo('');
      fetchEwayList();
    } catch (err) {
      notifyError(err, 'Failed to generate E-Way Bill');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = ewayList.filter((ewb) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (ewb.ewbNo || '').toLowerCase().includes(q) ||
      (ewb.vehicleNo || '').toLowerCase().includes(q) ||
      (ewb.transporterName || '').toLowerCase().includes(q) ||
      (ewb.docNo || '').toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    if (!filtered.length) return toast.info('No E-Way Bills to export');
    const cols = [
      { key: 'ewbNo', label: 'E-Way Bill No' },
      { key: 'ewbDate', label: 'Date', render: (r) => dt(r.ewbDate || r.createdAt) },
      { key: 'docNo', label: 'Invoice No' },
      { key: 'recipientGstin', label: 'Recipient GSTIN' },
      { key: 'transporterName', label: 'Transporter' },
      { key: 'vehicleNo', label: 'Vehicle No' },
      { key: 'totalValue', label: 'Consignment Value (₹)' },
      { key: 'validUpto', label: 'Valid Upto', render: (r) => dt(r.validUpto) },
      { key: 'status', label: 'Status' },
    ];
    exportTableToExcel(cols, filtered, `EWayBills_${new Date().toISOString().slice(0, 10)}`);
    toast.success('E-Way Bill register exported to Excel');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="E-Way Bill Hub & Transit Management" className="max-w-7xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
      <div className="flex flex-col h-full p-8 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Truck size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">E-Way Bill Hub</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Transit Compliance • Rule 138 • Part A & Part B Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
            >
              <Plus size={14} /> Generate E-Way Bill
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || !filtered.length}
              className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <FileSpreadsheet size={14} /> Excel Export
            </button>
            <button
              onClick={fetchEwayList}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="md:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by E-Way Bill No, Vehicle No, Transporter, Invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
            />
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between px-4">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Generated</span>
            <span className="text-base font-black text-slate-900">{ewayList.length}</span>
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between px-4">
            <span className="text-xs font-bold text-slate-400 uppercase">Active in Transit</span>
            <span className="text-base font-black text-emerald-600">
              {ewayList.filter((e) => e.status === 'GENERATED' || !e.status).length}
            </span>
          </div>
        </div>

        {/* E-Way Bill Table */}
        <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden flex flex-col bg-white">
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">E-Way Bill No</th>
                  <th className="px-4 py-3">EWB Date</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Party / Consignee</th>
                  <th className="px-4 py-3">Vehicle No</th>
                  <th className="px-4 py-3">Transporter</th>
                  <th className="px-4 py-3 text-right">Value (₹)</th>
                  <th className="px-4 py-3">Valid Upto</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="animate-spin text-amber-600" size={24} />
                        <span className="font-semibold text-xs">Loading E-Way Bill registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : !filtered.length ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck size={32} className="text-slate-300" />
                        <span className="font-semibold text-xs">No E-Way Bills found. Click Generate to create one.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((ewb, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                        {ewb.ewbNo || 'GENERATED-MOCK'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{dt(ewb.ewbDate || ewb.createdAt)}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{ewb.docNo || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700">
                        {ewb.recipientName || ewb.recipientGstin || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900 uppercase">
                        {ewb.vehicleNo || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{ewb.transporterName || 'Self / Own'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums">
                        {money(ewb.totalValue)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{dt(ewb.validUpto)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          {ewb.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">Generate E-Way Bill</h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleGenerate} className="mt-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Sales Invoice</label>
                <select
                  value={selectedSaleId}
                  onChange={(e) => setSelectedSaleId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
                  required
                >
                  <option value="">-- Choose Invoice --</option>
                  {salesInvoices.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.invoiceNo} — {s.customerId?.name || 'Party'} ({money(s.netAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehicle No</label>
                  <input
                    type="text"
                    placeholder="e.g. GJ05AB1234"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approx Distance (KM)</label>
                  <input
                    type="number"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transporter Name</label>
                  <input
                    type="text"
                    placeholder="Transport service name"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transporter ID (GSTIN)</label>
                  <input
                    type="text"
                    placeholder="15-digit Transporter ID"
                    value={transporterId}
                    onChange={(e) => setTransporterId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  {submitting ? 'Generating...' : 'Generate EWB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Modal>
  );
}
