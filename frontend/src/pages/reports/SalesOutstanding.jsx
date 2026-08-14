import React, { useState, useEffect, useMemo, useRef } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import useConfigStore from '../../store/useConfigStore';
import { toast } from '../../store/useToastStore';
import { SkeletonTable, InlineLoader, ButtonLoader } from '../../components/ui/loaders';
import { downloadCsv, fmtDate } from '../../utils/reportExport';

const todayISO = () => new Date().toISOString().split('T')[0];

const money = (n) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SalesOutstanding = ({ isOpen, onClose }) => {
  const { parties, fetchOutstanding, fetchParties } = useStore();
  const companyName = useConfigStore(
    (s) => s.companySettings?.legalName || s.companySettings?.shortName || s.company?.name || 'Company'
  );

  const [showPreview, setShowPreview] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [osType, setOsType] = useState('receivable');
  const [asOn, setAsOn] = useState(todayISO());
  const [partyId, setPartyId] = useState('');
  const [minDays, setMinDays] = useState('');
  const [showZero, setShowZero] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchParties?.().catch(() => {});
      setShowPreview(false);
      setExpanded({});
    }
  }, [isOpen, fetchParties]);

  const handleGeneratePreview = async () => {
    setLoading(true);
    setExpanded({});
    try {
      const data = await fetchOutstanding(osType, asOn);
      let rows = Array.isArray(data) ? data : [];
      if (partyId) {
        rows = rows.filter((r) => String(r.partyId) === String(partyId));
      }
      if (!showZero) {
        rows = rows.filter((r) => Number(r.totalOutstanding || 0) > 0.01);
      }
      if (minDays !== '' && Number(minDays) > 0) {
        const min = Number(minDays);
        rows = rows
          .map((r) => ({
            ...r,
            bills: (r.bills || []).filter((b) => Number(b.ageDays || 0) >= min),
          }))
          .filter((r) => (r.bills || []).length > 0)
          .map((r) => {
            const total = (r.bills || []).reduce((s, b) => s + Number(b.outstanding || 0), 0);
            return { ...r, totalOutstanding: total };
          });
      }
      setReportData(rows);
      setShowPreview(true);
    } catch (err) {
      toast.error(err, { fallback: 'Failed to generate report' });
    } finally {
      setLoading(false);
    }
  };

  const grandTotals = useMemo(
    () =>
      reportData.reduce(
        (acc, curr) => {
          acc.total += Number(curr.totalOutstanding || 0);
          acc.b30 += Number(curr.aging?.bucket30 || 0);
          acc.b60 += Number(curr.aging?.bucket60 || 0);
          acc.b90 += Number(curr.aging?.bucket90 || 0);
          acc.b90Plus += Number(curr.aging?.bucket90Plus || 0);
          return acc;
        },
        { total: 0, b30: 0, b60: 0, b90: 0, b90Plus: 0 }
      ),
    [reportData]
  );

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCsv = () => {
    if (reportData.length === 0) return toast.warning('No data to export');
    const headers = [
      'Party',
      'Mobile',
      'Bill No',
      'Bill Date',
      'Due Date',
      'Age Days',
      'Outstanding',
      'Follow-up',
      '0-30',
      '31-60',
      '61-90',
      '90+',
    ];
    const csvRows = [];
    reportData.forEach((r) => {
      const bills = r.bills || [];
      if (!bills.length) {
        csvRows.push([
          r.partyName,
          r.phone || '',
          '',
          '',
          '',
          '',
          Number(r.totalOutstanding || 0).toFixed(2),
          '',
          Number(r.aging?.bucket30 || 0).toFixed(2),
          Number(r.aging?.bucket60 || 0).toFixed(2),
          Number(r.aging?.bucket90 || 0).toFixed(2),
          Number(r.aging?.bucket90Plus || 0).toFixed(2),
        ]);
        return;
      }
      bills.forEach((b, i) => {
        csvRows.push([
          i === 0 ? r.partyName : '',
          i === 0 ? r.phone || '' : '',
          b.billNo,
          fmtDate(b.billDate),
          fmtDate(b.dueDate),
          b.ageDays,
          Number(b.outstanding || 0).toFixed(2),
          b.followUpStatus || '',
          i === 0 ? Number(r.aging?.bucket30 || 0).toFixed(2) : '',
          i === 0 ? Number(r.aging?.bucket60 || 0).toFixed(2) : '',
          i === 0 ? Number(r.aging?.bucket90 || 0).toFixed(2) : '',
          i === 0 ? Number(r.aging?.bucket90Plus || 0).toFixed(2) : '',
        ]);
      });
    });
    downloadCsv(`${osType}-outstanding-${asOn}.csv`, headers, csvRows);
    toast.success('CSV downloaded');
  };

  const handlePrint = () => {
    if (!reportData.length) return toast.warning('Generate report preview first');
    document.body.classList.add('ledger-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('ledger-printing'), 400);
    }, 50);
  };

  if (!isOpen) return null;

  const titleType = osType === 'receivable' ? 'Receivable (Sales)' : 'Payable (Purchase)';

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title={`Outstanding ${titleType}`} windowId="outstanding" bare>
      {({ WindowControls }) => (
        <>
          <div className="classic-erp-window os-window h-full min-h-0 !max-h-none flex flex-col">
            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">
                Outstanding Reports — {titleType}
              </span>
              <WindowControls />
            </div>

            <div className="os-toolbar print:hidden">
              <button
                type="button"
                className={`classic-erp-btn ${osType === 'receivable' ? 'btn-blue' : ''}`}
                onClick={() => setOsType('receivable')}
              >
                Sales Outstanding (Receivable)
              </button>
              <button
                type="button"
                className={`classic-erp-btn ${osType === 'payable' ? 'btn-blue' : ''}`}
                onClick={() => setOsType('payable')}
              >
                Purchase Outstanding (Payable)
              </button>

              <div className="h-4 w-px bg-emerald-700/40 mx-1" />

              <button
                type="button"
                className="classic-erp-btn ledger-green-btn"
                onClick={handleGeneratePreview}
                disabled={loading}
              >
                {loading ? <ButtonLoader label="Loading…" /> : 'Screen'}
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={handleExportCsv}
                disabled={!showPreview || reportData.length === 0}
              >
                Excel / CSV
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={handlePrint}
                disabled={!showPreview || reportData.length === 0}
              >
                Print
              </button>
            </div>

            <div className="os-toolbar2 print:hidden">
              <div className="os-toolbar2-row">
                <span className="classic-erp-label">As On Date</span>
                <input
                  type="date"
                  className="classic-erp-input os-date-red"
                  value={asOn}
                  onChange={(e) => setAsOn(e.target.value)}
                />

                <span className="classic-erp-label ml-2">Min Age (days)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0 = all"
                  className="classic-erp-input w-20"
                  value={minDays}
                  onChange={(e) => setMinDays(e.target.value)}
                />

                <span className="classic-erp-label ml-2">Party</span>
                <select
                  className="classic-erp-select max-w-[220px]"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">-- ALL PARTIES --</option>
                  {(parties || []).map((p) => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <label className="os-stmt-check ml-3">
                  <input
                    type="checkbox"
                    checked={showZero}
                    onChange={(e) => setShowZero(e.target.checked)}
                  />
                  Show Zero Balance
                </label>

                <button
                  type="button"
                  className="classic-erp-btn ledger-green-btn ml-auto font-bold"
                  onClick={handleGeneratePreview}
                  disabled={loading}
                >
                  OK
                </button>
              </div>
            </div>

            <div className="os-body" ref={printRef}>
              {!showPreview ? (
                <div className="p-8 max-w-xl mx-auto my-auto text-center bg-slate-50 border border-slate-300 rounded shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-2">
                    {titleType} Report Parameters
                  </h3>
                  <p className="text-xs text-slate-600 mb-6">
                    Configure your date range and party filters above, then click <strong>OK</strong> or <strong>Screen</strong> to generate the bill-wise outstanding statement.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      className="classic-erp-btn btn-blue px-6 py-1.5 font-bold text-sm"
                      onClick={handleGeneratePreview}
                      disabled={loading}
                    >
                      {loading ? <ButtonLoader label="Generating Preview…" /> : 'Generate Preview'}
                    </button>
                    <button type="button" className="classic-erp-btn px-6 py-1.5 text-sm" onClick={onClose}>
                      Close
                    </button>
                  </div>
                </div>
              ) : loading ? (
                <div className="p-4">
                  <InlineLoader message="Calculating outstanding balances…" className="mb-3" />
                  <SkeletonTable rows={10} cols={7} />
                </div>
              ) : (
                <div className="os-table-wrap">
                  <table className="os-table">
                    <thead>
                      <tr>
                        <th className="w-6 text-center">+/-</th>
                        <th>Party Name</th>
                        <th>Mobile</th>
                        <th className="num">0–30 Days</th>
                        <th className="num">31–60 Days</th>
                        <th className="num">61–90 Days</th>
                        <th className="num">90+ Days</th>
                        <th className="num">Total OS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row) => {
                        const id = String(row.partyId);
                        const open = !!expanded[id];
                        const bills = row.bills || [];
                        return (
                          <React.Fragment key={id}>
                            <tr
                              className={`os-party-row ${open ? 'is-open' : ''}`}
                              onClick={() => toggleExpand(id)}
                            >
                              <td className="text-center font-bold">{bills.length ? (open ? '−' : '+') : ''}</td>
                              <td className="font-bold text-blue-900">
                                {row.partyName}
                                {bills.length > 0 ? (
                                  <span className="text-[10px] text-slate-500 font-normal ml-2">
                                    ({bills.length} bill{bills.length > 1 ? 's' : ''})
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-slate-600">{row.phone || '—'}</td>
                              <td className="num">{money(row.aging?.bucket30)}</td>
                              <td className="num">{money(row.aging?.bucket60)}</td>
                              <td className="num">{money(row.aging?.bucket90)}</td>
                              <td className="num text-red-600 font-bold">{money(row.aging?.bucket90Plus)}</td>
                              <td className="num font-extrabold text-black">{money(row.totalOutstanding)}</td>
                            </tr>

                            {open && bills.length > 0 && (
                              <tr className="os-bills-subrow">
                                <td colSpan={8} className="p-0">
                                  <div className="os-subtable-container">
                                    <table className="os-subtable">
                                      <thead>
                                        <tr>
                                          <th>Bill No</th>
                                          <th>Bill Date</th>
                                          <th>Due Date</th>
                                          <th className="num">Age (Days)</th>
                                          <th className="num">Outstanding Amt</th>
                                          <th>Follow-up Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bills.map((b) => (
                                          <tr key={`${b.billId || b.billNo}-${b.billDate}`}>
                                            <td className="font-bold text-slate-800">{b.billNo}</td>
                                            <td>{fmtDate(b.billDate)}</td>
                                            <td>{fmtDate(b.dueDate)}</td>
                                            <td className={`num font-bold ${Number(b.ageDays) > 90 ? 'text-red-600' : ''}`}>
                                              {b.ageDays} d
                                            </td>
                                            <td className="num font-bold text-slate-900">{money(b.outstanding)}</td>
                                            <td className="text-slate-600">{b.followUpStatus || 'Pending'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {reportData.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-500 font-semibold">
                            No outstanding records found for the selected parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {reportData.length > 0 && (
                      <tfoot>
                        <tr className="os-total-row">
                          <td colSpan={3} className="font-extrabold text-right uppercase">
                            Grand Total ({reportData.length} Parties)
                          </td>
                          <td className="num font-extrabold">{money(grandTotals.b30)}</td>
                          <td className="num font-extrabold">{money(grandTotals.b60)}</td>
                          <td className="num font-extrabold">{money(grandTotals.b90)}</td>
                          <td className="num font-extrabold text-red-700">{money(grandTotals.b90Plus)}</td>
                          <td className="num font-extrabold text-black text-xs">{money(grandTotals.total)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            <div className="classic-erp-form-footer print:hidden">
              {showPreview && (
                <button type="button" className="classic-erp-btn" onClick={() => setShowPreview(false)}>
                  Parameters
                </button>
              )}
              <button
                type="button"
                className="classic-erp-btn"
                onClick={handleExportCsv}
                disabled={!showPreview || reportData.length === 0}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={handlePrint}
                disabled={!showPreview || reportData.length === 0}
              >
                Print
              </button>
              <button type="button" className="classic-erp-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
          <style>{osStyles}</style>
        </>
      )}
    </ErpWindowedModal>
  );
};

const osStyles = `
  .os-toolbar {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 8px;
    background: #9bc89b; border-bottom: 1px solid #7eab7e; align-items: center;
  }
  .os-toolbar2 {
    display: flex; gap: 12px; padding: 5px 8px;
    background: #9bc89b; border-bottom: 1px solid #7eab7e; align-items: center;
  }
  .os-toolbar2-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #111; width: 100%; }
  .os-date-red { border-color: #c00 !important; color: #c00 !important; font-weight: 700 !important; background: #fff !important; }
  .os-stmt-check { display: flex; align-items: center; gap: 4px; cursor: pointer; font-weight: 600; font-size: 11px; }
  .os-body { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; overflow: hidden; }
  .os-table-wrap { flex: 1; min-height: 280px; overflow: auto; }
  .os-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .os-table thead th {
    position: sticky; top: 0; z-index: 2; background: #9bc89b; color: #111; border-bottom: 2px solid #5a8a5a;
    padding: 6px 8px; font-size: 11px; font-weight: 800; text-align: left;
  }
  .os-table thead th.num, .os-table td.num { text-align: right; font-family: ui-monospace, Consolas, monospace; }
  .os-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  .os-party-row { cursor: pointer; background: #ffffff; }
  .os-party-row:nth-child(even) { background: #f8fafc; }
  .os-party-row:hover { background: #dbeafe; }
  .os-party-row.is-open { background: #e0f2fe; }
  .os-subtable-container { background: #f1f5f9; padding: 6px 12px 10px 32px; border-bottom: 2px solid #cbd5e1; }
  .os-subtable { width: 100%; border-collapse: collapse; font-size: 10px; background: #ffffff; border: 1px solid #cbd5e1; }
  .os-subtable th { background: #e2e8f0; padding: 4px 6px; border-bottom: 1px solid #cbd5e1; text-align: left; font-weight: 700; }
  .os-subtable td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
  .os-total-row td { background: #efe8dc !important; font-weight: 800; border-top: 2px solid #333; }
  @media print {
    body * { visibility: hidden !important; }
    .os-window, .os-window * { visibility: visible !important; }
    .os-window { position: absolute !important; left: 0; top: 0; width: 100% !important; background: #fff !important; }
    .print\\:hidden, .classic-erp-header, .classic-erp-form-footer, .os-toolbar { display: none !important; }
  }
`;

export default SalesOutstanding;
