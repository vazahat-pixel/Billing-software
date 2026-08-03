import React, { useState, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { ErpBusyOverlay } from '../../components/ui/loaders';
import { fmtAmt } from '../../utils/reportExport';

const todayMonth = () => new Date().toISOString().slice(0, 7);
const currentFy = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
};

const TABS = [
  { key: 'gstr9', label: 'Gstr-9' },
  { key: 'tds', label: 'Tds Report' },
  { key: 'tcs', label: 'Tcs Report' },
];

/**
 * GST Reports — Gstr-9 (annual) + Tds/Tcs Reports. These are the pieces that had zero UI
 * anywhere in the app. 3B Monthly Return, GSTR-1, GSTR-1 Error Checking, and GSTR-2B
 * Matching already exist as their own rich modals (see GstModals.jsx) — this doesn't
 * duplicate those. E-Way Bill submission/status and actual GSTR filing need real
 * GSTN/NIC/GSP portal credentials this app doesn't have, so those stay out of scope.
 */
const GstComplianceReportsModal = ({ isOpen, onClose }) => {
  const { fetchGstr9, fetchTdsReport } = useStore();

  const [tab, setTab] = useState('gstr9');
  const [period, setPeriod] = useState(todayMonth());
  const [fy, setFy] = useState(currentFy());
  const [loading, setLoading] = useState(false);
  const [gstr9, setGstr9] = useState(null);
  const [tdsReport, setTdsReport] = useState(null);
  const [tcsReport, setTcsReport] = useState(null);

  const generate = async () => {
    setLoading(true);
    try {
      if (tab === 'gstr9') setGstr9(await fetchGstr9(fy));
      else if (tab === 'tds') setTdsReport(await fetchTdsReport({ deductionType: 'TDS', period }));
      else if (tab === 'tcs') setTcsReport(await fetchTdsReport({ deductionType: 'TCS', period }));
    } finally {
      setLoading(false);
    }
  };

  const usesFy = tab === 'gstr9';

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="Gst Reports" windowId="gstComplianceReports" bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={loading} message="Building report…" />
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">Gst Reports</span>
            <WindowControls />
          </div>

          <div className="classic-erp-body flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 p-2">
            <div className="flex items-center gap-1 border-b border-slate-300 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`px-3 py-1 text-[11px] font-bold border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="classic-erp-frame flex items-center gap-3">
              {usesFy ? (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Financial Year:</span>
                  <input type="text" className="classic-erp-input w-24" value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2025-26" />
                </div>
              ) : (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Period:</span>
                  <input type="month" className="classic-erp-input" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
              )}
              <button type="button" className="classic-erp-btn btn-blue" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>

            {tab === 'gstr9' && gstr9 && (
              <div className="classic-erp-frame flex flex-col gap-2 text-[11px]">
                <div className="font-bold">FY {gstr9.period} — Annual Totals (Table 4)</div>
                <table className="w-full border-collapse">
                  <thead className="bg-slate-200">
                    <tr><th className="border px-2 py-1 text-left">Period</th><th className="border px-2 py-1 text-right">Taxable</th><th className="border px-2 py-1 text-right">CGST</th><th className="border px-2 py-1 text-right">SGST</th><th className="border px-2 py-1 text-right">IGST</th></tr>
                  </thead>
                  <tbody>
                    {(gstr9.payload?.monthly || []).map((m) => (
                      <tr key={m.period}>
                        <td className="border px-2 py-1">{m.period}</td>
                        <td className="border px-2 py-1 text-right font-mono">{fmtAmt(m.totals?.taxable)}</td>
                        <td className="border px-2 py-1 text-right font-mono">{fmtAmt(m.totals?.cgst)}</td>
                        <td className="border px-2 py-1 text-right font-mono">{fmtAmt(m.totals?.sgst)}</td>
                        <td className="border px-2 py-1 text-right font-mono">{fmtAmt(m.totals?.igst)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td className="border px-2 py-1">Total</td>
                      <td className="border px-2 py-1 text-right font-mono">{fmtAmt(gstr9.totals?.taxable)}</td>
                      <td className="border px-2 py-1 text-right font-mono">{fmtAmt(gstr9.totals?.cgst)}</td>
                      <td className="border px-2 py-1 text-right font-mono">{fmtAmt(gstr9.totals?.sgst)}</td>
                      <td className="border px-2 py-1 text-right font-mono">{fmtAmt(gstr9.totals?.igst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {(tab === 'tds' || tab === 'tcs') && (
              <TdsTcsReportView data={tab === 'tds' ? tdsReport : tcsReport} />
            )}
          </div>

          <div className="classic-erp-form-footer flex-wrap">
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

const TdsTcsReportView = ({ data }) => {
  if (!data) return null;
  return (
    <div className="classic-erp-frame flex flex-col gap-2 text-[11px]">
      <div className="font-bold">Total Deducted: ₹{fmtAmt(data.totalDeducted)}</div>
      <table className="w-full border-collapse">
        <thead className="bg-slate-200">
          <tr><th className="border px-2 py-1 text-left">Section</th><th className="border px-2 py-1 text-right">Count</th><th className="border px-2 py-1 text-right">Taxable</th><th className="border px-2 py-1 text-right">Deducted</th></tr>
        </thead>
        <tbody>
          {(data.bySection || []).map((s) => (
            <tr key={s.section}>
              <td className="border px-2 py-1 font-bold">{s.section}</td>
              <td className="border px-2 py-1 text-right font-mono">{s.count}</td>
              <td className="border px-2 py-1 text-right font-mono">{fmtAmt(s.taxable)}</td>
              <td className="border px-2 py-1 text-right font-mono">{fmtAmt(s.deducted)}</td>
            </tr>
          ))}
          {(!data.bySection || data.bySection.length === 0) && (
            <tr><td colSpan={4} className="border px-2 py-4 text-center text-slate-400">No entries for this period</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GstComplianceReportsModal;
