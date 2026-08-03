import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];

const TABS = [
  { key: 'yearClose', label: 'Closing / UnClosing Year' },
  { key: 'newYear', label: 'New A/c Year (Manual)' },
  { key: 'mismatch', label: 'MisMatch Data Scanner' },
  { key: 'series', label: 'Missing Series' },
];

/**
 * System Utilities — Year Closing/Reopening, New Financial Year, MisMatch Scanner, Missing Series.
 * Deliberately excludes Restore, Voucher ReIndex (renumbering), Bulk WhatsApp delivery, and
 * Email/SMTP setup — none of those have safe existing backend logic; building them rushed
 * risks real data loss or corruption, so they're left out rather than faked.
 */
const SystemUtilitiesModal = ({ isOpen, onClose }) => {
  const {
    fetchFinancialYears, createFinancialYear, validateYearClose,
    closeFinancialYear, reopenFinancialYear, fetchMismatchScan, fetchMissingSeries,
  } = useStore();

  const [tab, setTab] = useState('yearClose');
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState([]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [validation, setValidation] = useState(null);
  const [closeConfirmText, setCloseConfirmText] = useState('');
  const [nextFyCode, setNextFyCode] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenConfirmText, setReopenConfirmText] = useState('');

  const [newYearCode, setNewYearCode] = useState('');
  const [newYearStart, setNewYearStart] = useState(todayISO());
  const [newYearEnd, setNewYearEnd] = useState(todayISO());

  const [mismatch, setMismatch] = useState(null);
  const [series, setSeries] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchFinancialYears().then(setYears).finally(() => setLoading(false));
    setValidation(null);
    setCloseConfirmText('');
    setReopenReason('');
    setReopenConfirmText('');
  }, [isOpen, fetchFinancialYears]);

  const selectedFy = useMemo(
    () => years.find((y) => String(y._id || y.id) === String(selectedFyId)),
    [years, selectedFyId]
  );

  const handleValidate = async () => {
    if (!selectedFyId) return toast.error('Select a financial year');
    setLoading(true);
    try {
      const result = await validateYearClose(selectedFyId);
      setValidation(result);
      if (result?.exceptions?.length) toast.error(`${result.exceptions.length} issue(s) found — cannot close yet`);
      else toast.success('No blocking issues — safe to close');
    } catch (err) {
      toast.error(err, { fallback: 'Validation failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (closeConfirmText !== 'CLOSE') return toast.error('Type CLOSE to confirm');
    if (!validation || validation.exceptions?.length) return toast.error('Validate first — issues must be resolved');
    setLoading(true);
    try {
      await closeFinancialYear({ financialYearId: selectedFyId, nextFyCode: nextFyCode || undefined });
      toast.success('Financial year closed — balances carried forward');
      setCloseConfirmText('');
      setValidation(null);
      setYears(await fetchFinancialYears());
    } catch (err) {
      toast.error(err, { fallback: 'Failed to close year' });
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    if (reopenConfirmText !== 'REOPEN') return toast.error('Type REOPEN to confirm');
    if (!reopenReason.trim()) return toast.error('Reason is required to reopen a closed year');
    setLoading(true);
    try {
      await reopenFinancialYear({ financialYearId: selectedFyId, reason: reopenReason });
      toast.success('Financial year reopened');
      setReopenConfirmText('');
      setReopenReason('');
      setYears(await fetchFinancialYears());
    } catch (err) {
      toast.error(err, { fallback: 'Failed to reopen year' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYear = async () => {
    if (!newYearCode || !newYearStart || !newYearEnd) return toast.error('Fill code, start and end date');
    setLoading(true);
    try {
      await createFinancialYear({ code: newYearCode, startDate: newYearStart, endDate: newYearEnd });
      toast.success(`Financial year ${newYearCode} created`);
      setNewYearCode('');
      setYears(await fetchFinancialYears());
    } catch (err) {
      toast.error(err, { fallback: 'Failed to create financial year' });
    } finally {
      setLoading(false);
    }
  };

  const runMismatchScan = async () => {
    setLoading(true);
    try {
      setMismatch(await fetchMismatchScan());
    } finally {
      setLoading(false);
    }
  };

  const runSeriesScan = async () => {
    setLoading(true);
    try {
      setSeries(await fetchMissingSeries());
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="System Utilities" windowId="systemUtilities" bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={loading} message="Working…" />
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">System Utilities</span>
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

            {tab === 'yearClose' && (
              <div className="classic-erp-frame flex flex-col gap-3 text-[11px]">
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Financial Year:</span>
                  <select className="classic-erp-select flex-1" value={selectedFyId} onChange={(e) => { setSelectedFyId(e.target.value); setValidation(null); }}>
                    <option value="">- Select -</option>
                    {years.map((y) => (
                      <option key={y._id || y.id} value={y._id || y.id}>
                        {y.code} {y.isClosed ? '(Closed)' : y.isActive ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedFy && !selectedFy.isClosed && (
                  <div className="flex flex-col gap-2 bg-amber-50 border border-amber-300 rounded p-2">
                    <div className="font-bold text-amber-800">Close {selectedFy.code}</div>
                    <p className="text-slate-600">Validates trial balance + journal integrity first. Closing carries P&L into Retained Earnings and rolls balances into the next year — this cannot be casually undone.</p>
                    <button type="button" className="classic-erp-btn w-fit" onClick={handleValidate} disabled={loading}>1. Validate</button>
                    {validation && (
                      validation.exceptions?.length ? (
                        <ul className="text-red-700 list-disc pl-4">
                          {validation.exceptions.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      ) : (
                        <div className="text-green-700 font-bold">✓ Validated — no blocking issues</div>
                      )
                    )}
                    {validation && !validation.exceptions?.length && (
                      <>
                        <div className="classic-erp-field">
                          <span className="classic-erp-label">Next FY Code:</span>
                          <input type="text" className="classic-erp-input flex-1" value={nextFyCode} onChange={(e) => setNextFyCode(e.target.value)} placeholder="e.g. 2026-27 (auto if blank)" />
                        </div>
                        <div className="classic-erp-field">
                          <span className="classic-erp-label">Type CLOSE:</span>
                          <input type="text" className="classic-erp-input flex-1 font-mono" value={closeConfirmText} onChange={(e) => setCloseConfirmText(e.target.value)} />
                        </div>
                        <button type="button" className="classic-erp-btn btn-red w-fit" onClick={handleClose} disabled={loading || closeConfirmText !== 'CLOSE'}>2. Close Year</button>
                      </>
                    )}
                  </div>
                )}

                {selectedFy?.isClosed && (
                  <div className="flex flex-col gap-2 bg-rose-50 border border-rose-300 rounded p-2">
                    <div className="font-bold text-rose-800">Reopen {selectedFy.code}</div>
                    <p className="text-slate-600">Does not automatically reverse the closing/carry-forward entries — reopen only if you understand the accounting impact.</p>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Reason *:</span>
                      <input type="text" className="classic-erp-input flex-1" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Required — why are you reopening?" />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Type REOPEN:</span>
                      <input type="text" className="classic-erp-input flex-1 font-mono" value={reopenConfirmText} onChange={(e) => setReopenConfirmText(e.target.value)} />
                    </div>
                    <button type="button" className="classic-erp-btn btn-red w-fit" onClick={handleReopen} disabled={loading || reopenConfirmText !== 'REOPEN' || !reopenReason.trim()}>Reopen Year</button>
                  </div>
                )}
              </div>
            )}

            {tab === 'newYear' && (
              <div className="classic-erp-frame flex flex-col gap-2 text-[11px] max-w-md">
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Code:</span>
                  <input type="text" className="classic-erp-input flex-1" value={newYearCode} onChange={(e) => setNewYearCode(e.target.value)} placeholder="2026-27" />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Start Date:</span>
                  <input type="date" className="classic-erp-input flex-1" value={newYearStart} onChange={(e) => setNewYearStart(e.target.value)} />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">End Date:</span>
                  <input type="date" className="classic-erp-input flex-1" value={newYearEnd} onChange={(e) => setNewYearEnd(e.target.value)} />
                </div>
                <button type="button" className="classic-erp-btn btn-blue w-fit" onClick={handleCreateYear} disabled={loading}>Create Financial Year</button>
              </div>
            )}

            {tab === 'mismatch' && (
              <div className="classic-erp-frame flex flex-col gap-2 text-[11px]">
                <button type="button" className="classic-erp-btn btn-blue w-fit" onClick={runMismatchScan} disabled={loading}>Run Scan</button>
                {mismatch && (
                  <pre className="bg-slate-50 border border-slate-300 rounded p-2 overflow-auto max-h-96 text-[10px]">{JSON.stringify(mismatch, null, 2)}</pre>
                )}
              </div>
            )}

            {tab === 'series' && (
              <div className="classic-erp-frame flex flex-col gap-2 text-[11px]">
                <button type="button" className="classic-erp-btn btn-blue w-fit" onClick={runSeriesScan} disabled={loading}>Scan for Gaps</button>
                {series && (
                  <>
                    <div className="font-bold">Sales: {series.sales.gapCount} gap(s) in {series.sales.total} invoices</div>
                    {series.sales.gaps.slice(0, 50).map((g, i) => (
                      <div key={i} className="text-red-700">Missing {g.prefix}{g.missingNumber} (between {g.prefix}{g.betweenAfter} and {g.prefix}{g.betweenBefore})</div>
                    ))}
                    <div className="font-bold mt-2">Purchase: {series.purchase.gapCount} gap(s) in {series.purchase.total} bills</div>
                    {series.purchase.gaps.slice(0, 50).map((g, i) => (
                      <div key={i} className="text-red-700">Missing {g.prefix}{g.missingNumber} (between {g.prefix}{g.betweenAfter} and {g.prefix}{g.betweenBefore})</div>
                    ))}
                    {series.sales.gapCount === 0 && series.purchase.gapCount === 0 && (
                      <div className="text-green-700 font-bold">✓ No gaps detected</div>
                    )}
                  </>
                )}
              </div>
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

export default SystemUtilitiesModal;
