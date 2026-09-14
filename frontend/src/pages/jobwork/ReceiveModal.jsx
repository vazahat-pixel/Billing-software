import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ERPSelect } from '../../components/forms/FormElements';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import JobWorkPrint from '../../components/print/JobWorkPrint';
import { Plus, Trash2 } from 'lucide-react';

const today = () => new Date().toISOString().substring(0, 10);

/** One grid row = one Mill Issue challan being received against this bill. */
const blankLine = () => ({
   id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
   jobId: '',
   lotNo: '',
   chlnNo: '',
   itemName: '',
   gPcs: '0',
   greyMts: '0.00',
   finishMts: '0.00',
   finalMts: '0.00',
   jobRate: '0.00',
   cp: '',
   tp: '',
   finishItem: '',
   cut: '0',
   fPcs: '0',
   procType: '',
   cuttingPending: '',
   // Defaults to a full/final receive — matches how this screen always behaved before
   // partial receiving existed. Uncheck when more is still expected from this challan.
   isFinal: true,
   pendingQty: 0,
   pendingPcs: 0,
});

const jobPending = (job) => ({
   qty: job.pendingQty ?? Math.max(0, Number(job.issueQty || 0) - Number(job.receivedQty || 0)),
   pcs: job.pendingPcs ?? Math.max(0, Number(job.issuePcs || 0) - Number(job.receivedPcs || 0)),
});

const lineShortagePct = (line) => {
   const grey = Number(line.greyMts) || 0;
   const finish = Number(line.finishMts) || 0;
   if (grey <= 0 || finish <= 0) return '0.0';
   const pct = ((grey - finish) / grey) * 100;
   return isNaN(pct) ? '0.0' : pct.toFixed(1);
};

const lineJobAmt = (line) => {
   const finalVal = Number(line.finalMts) || 0;
   const finish = Number(line.finishMts) || 0;
   const rateVal = Number(line.jobRate) || 0;
   const qty = finalVal > 0 ? finalVal : finish;
   return Number((qty * rateVal).toFixed(2));
};

const ReceiveModal = ({ isOpen, onClose, selectedBook = null, onOpenPayment = null }) => {
   const {
      jobWorkEntries,
      parties,
      fetchJobs,
      fetchParties,
      receiveFromMill,
      updateJobReceive,
      fetchInventory,
      items,
      fetchItems
   } = useStore();

   const [activeTab, setActiveTab] = useState('Mill Receive');
   const [saving, setSaving] = useState(false);
   const [bootLoading, setBootLoading] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false);

   // Header (bill-level — shared across every line in this receipt)
   const [selectedJobPartyId, setSelectedJobPartyId] = useState('');
   const [gstin, setGstin] = useState('');
   const [billGpNo, setBillGpNo] = useState('');
   const [reverseCharge, setReverseCharge] = useState('No');
   const [hsnCd, setHsnCd] = useState('');
   const [billType, setBillType] = useState('Process');
   const [totalProcessAmt] = useState('1164');
   const [serialNo] = useState('4');
   const [receiveDate, setReceiveDate] = useState(today());

   // Multi-row grid — one row per challan being received into this bill
   const [lines, setLines] = useState([blankLine()]);

   const [printOpen, setPrintOpen] = useState(false);
   const [showLotDropdown, setShowLotDropdown] = useState(false);
   const [lookupTargetIdx, setLookupTargetIdx] = useState(null);
   const [dropdownSelectIdx, setDropdownSelectIdx] = useState(0);
   const dropdownRef = React.useRef(null);

   // Footer Adjustments
   const [lessPercent, setLessPercent] = useState('0');
   const [lessAmt, setLessAmt] = useState('0.00');
   const [otherLessPercent, setOtherLessPercent] = useState('0.00');
   const [otherLessAmt, setOtherLessAmt] = useState('0.00');
   const [otherAddPercent, setOtherAddPercent] = useState('0.00');
   const [otherAddAmt, setOtherAddAmt] = useState('0.00');
   const [remark, setRemark] = useState('');

   // TDS details
   const [onTdsAmt, setOnTdsAmt] = useState('0.00');
   const [tdsPercent, setTdsPercent] = useState('0');
   const [tdsAmt, setTdsAmt] = useState('0.00');

   // GST details
   const [sgstPercent, setSgstPercent] = useState('0');
   const [cgstPercent, setCgstPercent] = useState('0');
   const [igstPercent, setIgstPercent] = useState('0');

   // Totals Block
   const [rcmGst, setRcmGst] = useState('0.00');

   // Find/Search state
   const [showFindDialog, setShowFindDialog] = useState(false);
   const [findSearchText, setFindSearchText] = useState('');
   const [findActiveIdx, setFindActiveIdx] = useState(0);
   const findInputRef = useRef(null);

   const sortedReceivedJobs = useMemo(() => {
      const list = (jobWorkEntries || []).filter(j => j.status === 'Received' || j.status === 'Partial');
      return list.sort((a, b) => {
         const numA = parseInt(String(a.billGpNo || a.jobCardNo || a.challanNo || '').replace(/\D/g, ''), 10);
         const numB = parseInt(String(b.billGpNo || b.jobCardNo || b.challanNo || '').replace(/\D/g, ''), 10);
         if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
         return new Date(a.receiveDate || a.updatedAt || 0) - new Date(b.receiveDate || b.updatedAt || 0);
      });
   }, [jobWorkEntries]);

   const filteredReceivedJobs = useMemo(() => {
      const q = findSearchText.trim().toLowerCase();
      if (!q) return sortedReceivedJobs;
      return sortedReceivedJobs.filter(j => {
         const billNo = String(j.billGpNo || j.jobCardNo || j.challanNo || '').toLowerCase();
         const numOnly = billNo.replace(/\D/g, '');
         const mill = String(j.workerId?.name || '').toLowerCase();
         const item = String(j.lotId?.itemName || '').toLowerCase();
         return billNo.includes(q) || numOnly.includes(q) || mill.includes(q) || item.includes(q);
      });
   }, [sortedReceivedJobs, findSearchText]);

   const handleOpenFindModal = () => {
      setFindSearchText('');
      setFindActiveIdx(Math.max(0, sortedReceivedJobs.length - 1));
      setShowFindDialog(true);
      setTimeout(() => {
         findInputRef.current?.focus();
         try { findInputRef.current?.select(); } catch {}
      }, 50);
   };

   const handleLoadReceivedJob = (job) => {
      if (!job) return;
      const workerId = job.workerId?._id || job.workerId || '';
      setSelectedJobPartyId(workerId);
      const workerParty = (parties || []).find(p => String(p._id || p.id) === String(workerId));
      setGstin(job.workerId?.gstin || workerParty?.gstin || '');
      setBillGpNo(job.billGpNo || '');
      setReceiveDate(job.receiveDate ? String(job.receiveDate).slice(0, 10) : today());
      setBillType(job.billType || 'Process');

      // Find all sibling jobs that were received under the same billGpNo, so multi-line bills load completely
      const siblingJobs = job.billGpNo
         ? (jobWorkEntries || []).filter(j => j.billGpNo && String(j.billGpNo).trim() === String(job.billGpNo).trim() && (j.status === 'Received' || j.status === 'Partial'))
         : [job];
      const jobsToLoad = siblingJobs.length > 0 ? siblingJobs : [job];

      const loadedLines = jobsToLoad.map(j => {
         const pending = jobPending(j);
         const rate = Number(j.jobRate || (Number(j.receivedQty) > 0 ? (Number(j.processCharges || 0) / Number(j.receivedQty)) : 0) || 0);
         return {
            id: `line-${j._id || Math.random().toString(36).slice(2, 7)}`,
            jobId: j._id || j.id,
            lotNo: j.lotId?.lotId || '',
            chlnNo: j.challanNo || j.jobCardNo || '',
            itemName: j.lotId?.itemId?.name || j.lotId?.itemName || j.itemName || '',
            cp: 'C',
            tp: '',
            finishItem: j.outputItemId?.name || '',
            cut: '0',
            procType: j.processType || 'Finish',
            cuttingPending: 'P',
            gPcs: String(j.issuePcs || '0'),
            greyMts: Number(j.issueQty || 0).toFixed(2),
            finishMts: Number(j.receivedQty || 0).toFixed(2),
            finalMts: Number(j.receivedQty || 0).toFixed(2),
            fPcs: String(j.receivedPcs || j.fPcs || j.issuePcs || '0'),
            jobRate: rate.toFixed(2),
            isFinal: j.status === 'Received',
            pendingQty: pending.qty,
            pendingPcs: pending.pcs,
            isEdit: true,
         };
      });

      setLines(loadedLines.length > 0 ? loadedLines : [blankLine()]);

      // Sync GST percentages
      const firstJob = jobsToLoad[0];
      const lotItemId = firstJob?.lotId?.itemId?._id || firstJob?.lotId?.itemId || firstJob?.itemId;
      const itemName = firstJob?.lotId?.itemId?.name || firstJob?.lotId?.itemName || firstJob?.itemName || '';
      const masterItem = (items || []).find((it) => 
         (lotItemId && String(it._id || it.id) === String(lotItemId)) ||
         (itemName && (it.name || it.itemName || '').trim().toLowerCase() === itemName.trim().toLowerCase())
      );
      const rawGst = firstJob?.gstPercent != null && Number(firstJob.gstPercent) > 0
         ? Number(firstJob.gstPercent)
         : (masterItem?.gstRate != null ? Number(masterItem.gstRate) : 5);
      
      setSgstPercent((rawGst / 2).toString());
      setCgstPercent((rawGst / 2).toString());
      setIgstPercent('0');

      setIsEditMode(true);
      setShowFindDialog(false);
      setActiveTab('Mill Receive');
      notifySuccess(`Loaded Receipt #${job.billGpNo || job.jobCardNo} in Edit mode`);
   };

   const handleFindKeyDown = (e) => {
      if (e.key === 'Escape') {
         e.preventDefault();
         setShowFindDialog(false);
         return;
      }

      if (e.key === '+' || e.key === '=') {
         e.preventDefault();
         setFindActiveIdx((prev) => Math.min(prev + 1, filteredReceivedJobs.length - 1));
         return;
      }

      if (e.key === '-' || e.key === '_') {
         e.preventDefault();
         setFindActiveIdx((prev) => Math.max(prev - 1, 0));
         return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
         e.preventDefault();
         setFindActiveIdx((prev) => Math.min(prev + 1, filteredReceivedJobs.length - 1));
         return;
      }

      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
         e.preventDefault();
         setFindActiveIdx((prev) => Math.max(prev - 1, 0));
         return;
      }

      if (e.key === 'Enter') {
         e.preventDefault();
         const job = filteredReceivedJobs[findActiveIdx];
         if (job) handleLoadReceivedJob(job);
      }
   };

   useEffect(() => {
      if (!isOpen) {
         setBootLoading(false);
         return;
      }
      let cancelled = false;
      setBootLoading(true);
      Promise.all([fetchJobs(), fetchParties?.(), fetchInventory?.(), fetchItems?.()])
         .catch(() => { })
         .finally(() => {
            if (!cancelled) setBootLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, [isOpen, fetchJobs, fetchParties, fetchInventory, fetchItems]);

   useEffect(() => {
      if (!isOpen) return undefined;

      const onKeyDown = (e) => {
         if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'f')) {
            e.preventDefault();
            e.stopPropagation();
            handleOpenFindModal();
            return;
         }

         if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            handleNew();
         }
      };

      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
   }, [isOpen, sortedReceivedJobs, showFindDialog]);

   // Auto-sync GST from Item Master whenever a challan/item is loaded in the grid
   useEffect(() => {
      const activeLine = lines.find((l) => l.jobId || l.itemName);
      if (activeLine && Number(sgstPercent) === 0 && Number(cgstPercent) === 0 && Number(igstPercent) === 0) {
         const name = (activeLine.itemName || '').trim().toLowerCase();
         const match = (items || []).find((it) => (it.name || it.itemName || '').trim().toLowerCase() === name);
         const rate = match?.gstRate != null && Number(match.gstRate) > 0 ? Number(match.gstRate) : 5;
         setSgstPercent((rate / 2).toString());
         setCgstPercent((rate / 2).toString());
         setIgstPercent('0');
      }
   }, [lines, items, sgstPercent, cgstPercent, igstPercent]);

   // Handle escape key globally to close lookup dialog
   useEffect(() => {
      const handleGlobalKeyDown = (e) => {
         if (e.key === 'Escape') {
            setShowLotDropdown(false);
         }
      };
      if (showLotDropdown) {
         window.addEventListener('keydown', handleGlobalKeyDown);
      }
      return () => {
         window.removeEventListener('keydown', handleGlobalKeyDown);
      };
   }, [showLotDropdown]);

   const pendingJobs = useMemo(() => {
      return (jobWorkEntries || []).filter(j => {
         const s = String(j.status || '').toLowerCase();
         return s !== 'received' && s !== 'cancelled';
      });
   }, [jobWorkEntries]);

   const jobPartyOptions = useMemo(() => {
      const uniqueParties = {};
      (parties || []).forEach((p) => {
         uniqueParties[String(p._id || p.id)] = p.name;
      });
      pendingJobs.forEach(j => {
         if (j.workerId) {
            const id = String(typeof j.workerId === 'object' ? j.workerId._id || j.workerId.id : j.workerId);
            const name = typeof j.workerId === 'object' ? j.workerId.name : null;
            if (id && name) uniqueParties[id] = name;
         }
      });
      return Object.entries(uniqueParties).map(([id, name]) => ({
         value: id,
         label: name
      }));
   }, [pendingJobs, parties]);

   const partyPendingJobs = useMemo(() => {
      if (!selectedJobPartyId) return [];
      const targetPartyObj = (parties || []).find((p) => String(p._id || p.id) === String(selectedJobPartyId));
      const targetName = (targetPartyObj?.name || '').trim().toLowerCase();
      const targetId = String(selectedJobPartyId).trim();

      return pendingJobs.filter(j => {
         const rawWorker = j.workerId;
         const workerIdStr = String(
            (typeof rawWorker === 'object' ? rawWorker?._id || rawWorker?.id : rawWorker) ||
            (typeof j.partyId === 'object' ? j.partyId?._id || j.partyId?.id : j.partyId) ||
            ''
         ).trim();

         if (workerIdStr && workerIdStr === targetId) return true;

         const workerName = String(
            j.workerId?.name || j.workerName || j.partyName || j.weaver || ''
         ).trim().toLowerCase();

         if (targetName && workerName && (workerName === targetName || workerName.includes(targetName) || targetName.includes(workerName))) {
            return true;
         }

         return false;
      });
   }, [pendingJobs, selectedJobPartyId, parties]);

   // Job cards already picked into another row of this same bill — don't offer them twice
   const usedJobIds = useMemo(
      () => new Set(lines.map(l => l.jobId).filter(Boolean).map(String)),
      [lines]
   );

   const associatedLots = useMemo(() => {
      const targetLine = lookupTargetIdx != null ? lines[lookupTargetIdx] : null;
      const excludeId = targetLine?.jobId ? String(targetLine.jobId) : null;
      const pool = partyPendingJobs.length > 0 ? partyPendingJobs : pendingJobs;
      const available = pool.filter(
         j => !usedJobIds.has(String(j._id)) || String(j._id) === excludeId
      );
      const q = String(targetLine?.chlnNo || '').trim().toLowerCase();
      if (!q || targetLine?.jobId) return available;
      const filtered = available.filter(j => {
         const lotVal = String(j.lotId?.lotId || j.lotId || '').toLowerCase();
         const chlnVal = String(j.jobCardNo || j.challanNo || '').toLowerCase();
         const itemVal = String(j.lotId?.itemId?.name || j.lotId?.itemName || '').toLowerCase();
         return lotVal.includes(q) || chlnVal.includes(q) || itemVal.includes(q);
      });
      return filtered.length > 0 ? filtered : available;
   }, [partyPendingJobs, pendingJobs, lines, lookupTargetIdx, usedJobIds]);

   const receivedJobs = useMemo(() => {
      return jobWorkEntries.filter(j => j.status === 'Received' || j.status === 'Partial');
   }, [jobWorkEntries]);

   const setLineField = (idx, key, value) => {
      setLines(prev => {
         const next = [...prev];
         const line = { ...next[idx], [key]: value };
         if (key === 'finishMts') {
            const cutVal = Number(line.cut) || 0;
            const finish = Number(value) || 0;
            if (cutVal > 0 && finish > 0) line.fPcs = String(Math.round(finish / cutVal));
         }
         next[idx] = line;
         return next;
      });
   };

   const handleCutChange = (idx, val) => {
      setLines(prev => {
         const next = [...prev];
         const finish = Number(next[idx].finishMts) || 0;
         const cutVal = Number(val) || 0;
         next[idx] = {
            ...next[idx],
            cut: val,
            fPcs: cutVal > 0 && finish > 0 ? String(Math.round(finish / cutVal)) : next[idx].fPcs,
         };
         return next;
      });
   };

   const handleFPcsChange = (idx, val) => {
      setLines(prev => {
         const next = [...prev];
         const finish = Number(next[idx].finishMts) || 0;
         const pcsVal = Number(val) || 0;
         next[idx] = {
            ...next[idx],
            fPcs: val,
            cut: pcsVal > 0 && finish > 0 ? (finish / pcsVal).toFixed(2) : next[idx].cut,
         };
         return next;
      });
   };

   const addLine = () => setLines(prev => [...prev, blankLine()]);

   const removeLine = (idx) => {
      setLines(prev => (prev.length <= 1 ? [blankLine()] : prev.filter((_, i) => i !== idx)));
   };

   const openLotLookup = (idx) => {
      if (!selectedJobPartyId) {
         notifyWarning('Please select a Job Party first');
         return;
      }
      setLookupTargetIdx(idx);
      setShowLotDropdown(true);
   };

   const handleSelectLot = (job, idx, options = {}) => {
      // Pre-fill from what's still PENDING on this job, not the original issued amount —
      // a job already carrying an earlier partial receive should default to the balance
      // still owed, not the full challan quantity all over again.
      const pending = jobPending(job);
      setLines(prev => {
         const next = [...prev];
         next[idx] = {
            ...next[idx],
            jobId: job._id,
            lotNo: job.lotId?.lotId || '',
            chlnNo: job.challanNo || job.jobCardNo || '',
            itemName: job.lotId?.itemId?.name || job.lotId?.itemName || '',
            cp: 'C',
            cuttingPending: 'P',
            procType: 'Finish',
            gPcs: String(pending.pcs),
            greyMts: pending.qty.toFixed(2),
            finishMts: '0.00',
            finalMts: '0.00',
            fPcs: String(pending.pcs),
            jobRate: Number(job.jobRate || 0).toFixed(2),
            isFinal: true,
            pendingQty: pending.qty,
            pendingPcs: pending.pcs,
         };
         return next;
      });

      // Header GSTIN / HSN come from the job worker on the first pick
      const workerGstin = job.workerId?.gstin || (parties || []).find((p) => String(p._id || p.id) === String(selectedJobPartyId))?.gstin || '';
      setGstin(workerGstin);
      // Auto-set GST: Priority 1) Job GST% -> 2) Item Master GST% -> 3) Standard Process Charge 5% (SGST 2.5% + CGST 2.5%)
      const lotItemId = job.lotId?.itemId?._id || job.lotId?.itemId || job.itemId;
      const itemName = job.lotId?.itemId?.name || job.lotId?.itemName || job.itemName || '';
      const masterItem = (items || []).find((it) => 
         (lotItemId && String(it._id || it.id) === String(lotItemId)) ||
         (itemName && (it.name || it.itemName || '').trim().toLowerCase() === itemName.trim().toLowerCase())
      );
      const itemGstRate = masterItem?.gstRate ?? job.lotId?.itemId?.gstRate;

      const rawGst = job.gstPercent != null && job.gstPercent !== '' && Number(job.gstPercent) > 0
         ? Number(job.gstPercent) 
         : (itemGstRate != null && itemGstRate !== '' && Number(itemGstRate) > 0 ? Number(itemGstRate) : 5);

      setSgstPercent(rawGst > 0 ? (rawGst / 2).toString() : '2.5');
      setCgstPercent(rawGst > 0 ? (rawGst / 2).toString() : '2.5');
      setIgstPercent('0');

      const focusFieldId = options.focusField || `grid-finish-mts-${idx}`;
      setTimeout(() => {
         const el = document.getElementById(focusFieldId);
         if (el) {
            el.focus();
            el.select?.();
         }
      }, 100);
   };

   const handleChlnNoEnter = (e, idx) => {
      if (!selectedJobPartyId) {
         notifyWarning('Please select a Job Party first');
         return;
      }
      const typedChln = String(lines[idx]?.chlnNo || '').trim();
      if (!typedChln) {
         e.preventDefault();
         e.stopPropagation();
         setLookupTargetIdx(idx);
         setShowLotDropdown(true);
         return;
      }

      const query = typedChln.toLowerCase();
      const excludeId = lines[idx]?.jobId ? String(lines[idx].jobId) : null;
      const available = partyPendingJobs.filter(
         j => !usedJobIds.has(String(j._id)) || String(j._id) === excludeId
      );
      const matches = available.filter(j =>
         String(j.jobCardNo || '').toLowerCase() === query ||
         String(j.challanNo || '').toLowerCase() === query
      );

      if (matches.length === 1) {
         e.preventDefault();
         e.stopPropagation();
         handleSelectLot(matches[0], idx, { focusField: `grid-finish-mts-${idx}` });
         notifySuccess(`Loaded Challan ${matches[0].challanNo || matches[0].jobCardNo}`);
      } else if (matches.length > 1) {
         e.preventDefault();
         e.stopPropagation();
         setLookupTargetIdx(idx);
         setShowLotDropdown(true);
      } else {
         e.preventDefault();
         e.stopPropagation();
         setLookupTargetIdx(idx);
         setShowLotDropdown(true);
         notifyWarning(`No pending issue found with Challan No: "${typedChln}"`);
      }
   };

   useEffect(() => {
      if (showLotDropdown) {
         setDropdownSelectIdx(0);
         setTimeout(() => {
            dropdownRef.current?.focus();
         }, 50);
      }
   }, [showLotDropdown]);

   const handleDropdownKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
         e.preventDefault();
         setDropdownSelectIdx((prev) => Math.min(prev + 1, Math.max(0, associatedLots.length - 1)));
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setDropdownSelectIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
         e.preventDefault();
         if (associatedLots[dropdownSelectIdx] && lookupTargetIdx != null) {
            handleSelectLot(associatedLots[dropdownSelectIdx], lookupTargetIdx);
            setShowLotDropdown(false);
         }
      } else if (e.key === 'Escape') {
         e.preventDefault();
         setShowLotDropdown(false);
      }
   };

   // Derived per-line + bill-level calculations
   const linesWithAmt = useMemo(
      () => lines.map((l) => ({ ...l, jobAmt: lineJobAmt(l) })),
      [lines]
   );

   const computedGrossAmt = useMemo(
      () => linesWithAmt.reduce((s, l) => s + (Number(l.jobAmt) || 0), 0),
      [linesWithAmt]
   );

   const computedTaxableAmt = useMemo(() => {
      const gross = computedGrossAmt;
      const lessVal = Number(lessAmt) || 0;
      const otherLess = Number(otherLessAmt) || 0;
      const otherAdd = Number(otherAddAmt) || 0;
      const base = Math.max(0, gross - lessVal - otherLess + otherAdd);
      return Number(base.toFixed(2));
   }, [computedGrossAmt, lessAmt, otherLessAmt, otherAddAmt]);

   const gridTotals = useMemo(
      () =>
         lines.reduce(
            (acc, l) => ({
               fPcs: acc.fPcs + (Number(l.fPcs) || 0),
               greyMts: acc.greyMts + (Number(l.greyMts) || 0),
               finishMts: acc.finishMts + (Number(l.finishMts) || 0),
            }),
            { fPcs: 0, greyMts: 0, finishMts: 0 }
         ),
      [lines]
   );

   const finishItemOptions = useMemo(() => {
      return (items || []).map((item) => ({
         value: item.name || item.itemName || '',
         label: item.name || item.itemName || '',
      })).sort((a, b) => a.label.localeCompare(b.label));
   }, [items]);

   // Synchronize TDS base amount to Taxable Amount (Gross - Less - Other Less + Other Add)
   useEffect(() => {
      setOnTdsAmt(computedTaxableAmt.toFixed(2));
   }, [computedTaxableAmt]);

   const effectiveGstBase = useMemo(() => {
      const v = Number(onTdsAmt);
      return !isNaN(v) && v >= 0 ? v : computedTaxableAmt;
   }, [onTdsAmt, computedTaxableAmt]);

   // Synchronize TDS Amt state from base/percent
   useEffect(() => {
      const pct = Number(tdsPercent) || 0;
      setTdsAmt(((effectiveGstBase * pct) / 100).toFixed(2));
   }, [effectiveGstBase, tdsPercent]);

   // Handlers for percentage adjustments
   const handleLessPercentChange = (val) => {
      setLessPercent(val);
      const gross = computedGrossAmt;
      const pct = Number(val) || 0;
      setLessAmt(((gross * pct) / 100).toFixed(2));
   };

   const handleOtherLessPercentChange = (val) => {
      setOtherLessPercent(val);
      const gross = computedGrossAmt;
      const pct = Number(val) || 0;
      setOtherLessAmt(((gross * pct) / 100).toFixed(2));
   };

   const handleOtherAddPercentChange = (val) => {
      setOtherAddPercent(val);
      const gross = computedGrossAmt;
      const pct = Number(val) || 0;
      setOtherAddAmt(((gross * pct) / 100).toFixed(2));
   };

   // Sync footer adjustment amounts if gross amount changes
   useEffect(() => {
      const gross = computedGrossAmt;

      const pct1 = Number(lessPercent) || 0;
      if (pct1 > 0) setLessAmt(((gross * pct1) / 100).toFixed(2));

      const pct2 = Number(otherLessPercent) || 0;
      if (pct2 > 0) setOtherLessAmt(((gross * pct2) / 100).toFixed(2));

      const pct3 = Number(otherAddPercent) || 0;
      if (pct3 > 0) setOtherAddAmt(((gross * pct3) / 100).toFixed(2));
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [computedGrossAmt]);

   const computedSgstAmt = useMemo(() => {
      const pct = Number(sgstPercent) || 0;
      return ((effectiveGstBase * pct) / 100).toFixed(2);
   }, [effectiveGstBase, sgstPercent]);

   const computedCgstAmt = useMemo(() => {
      const pct = Number(cgstPercent) || 0;
      return ((effectiveGstBase * pct) / 100).toFixed(2);
   }, [effectiveGstBase, cgstPercent]);

   const computedIgstAmt = useMemo(() => {
      const pct = Number(igstPercent) || 0;
      return ((effectiveGstBase * pct) / 100).toFixed(2);
   }, [effectiveGstBase, igstPercent]);

   const computedNetAmt = useMemo(() => {
      const taxable = effectiveGstBase;
      const sgst = Number(computedSgstAmt) || 0;
      const cgst = Number(computedCgstAmt) || 0;
      const igst = Number(computedIgstAmt) || 0;
      const rcm = reverseCharge === 'Yes' ? (Number(rcmGst) || 0) : 0;

      return Number((taxable + sgst + cgst + igst + rcm).toFixed(2));
   }, [effectiveGstBase, computedSgstAmt, computedCgstAmt, computedIgstAmt, reverseCharge, rcmGst]);

   const computedRoundOff = useMemo(() => {
      const net = computedNetAmt;
      const rounded = Math.round(net);
      return (rounded - net).toFixed(2);
   }, [computedNetAmt]);

   const computedFinalAmt = useMemo(() => {
      const net = computedNetAmt;
      const tds = Number(tdsAmt) || 0;
      return (net - tds).toFixed(2);
   }, [computedNetAmt, tdsAmt]);

   /**
    * Job Card / Cutting Report sheet, built from the live grid rows and the header the
    * operator is looking at. Shortage is the same Grey−Finish figure the grid derives, so
    * the printed report cannot disagree with the screen.
    */
   const printData = useMemo(() => {
      const rows = linesWithAmt.filter((l) => l.jobId || Number(l.greyMts) || Number(l.finishMts));
      const partyName = (parties || []).find(
         (p) => String(p._id || p.id) === String(selectedJobPartyId)
      )?.name || '';
      return {
         millName: partyName,
         weaver: rows[0]?.weaver || '',
         quality: rows[0]?.itemName || '',
         billGpNo,
         chlnNo: rows[0]?.chlnNo || '',
         lotNo: rows[0]?.lotNo || '',
         serialNo,
         lines: rows.map((l) => ({
            greyMts: l.greyMts,
            recMts: l.finishMts,
            shortage: Math.max(0, Number(l.greyMts || 0) - Number(l.finishMts || 0)),
            remark,
            chekMts: '',
            secondMts: '',
            recDate: receiveDate,
         })),
         totalPcs: gridTotals.fPcs,
         tpPcs: gridTotals.fPcs,
         totalShortage: Math.max(0, gridTotals.greyMts - gridTotals.finishMts),
         puRate: rows[0]?.jobRate || 0,
         puAmt: computedGrossAmt,
         gpRate: rows[0]?.jobRate || 0,
         gpAmount: computedGrossAmt,
      };
   }, [linesWithAmt, parties, selectedJobPartyId, billGpNo, serialNo, remark, receiveDate, gridTotals, computedGrossAmt]);

   const handleFind = () => {
      setShowFindDialog(true);
      setFindSearchText('');
      setFoundRecords([]);
   };

   const handleNew = () => {
      setLines([blankLine()]);
      setSelectedJobPartyId('');
      setGstin('');
      setBillGpNo('');
      setReceiveDate(today());
      setRemark('');
      setIsEditMode(false);
      notifySuccess('Cleared for new Mill Receive entry');
   };

   const handleLoadRecord = (record) => {
      // Load the selected record into the form
      setSelectedJobPartyId(record.partyId || '');
      setGstin(record.gstin || '');
      setBillGpNo(record.billGpNo || '');
      setReceiveDate(record.receiveDate || today());
      setRemark(record.remark || '');
      if (record.lines && Array.isArray(record.lines)) {
         setLines(record.lines);
      }
      setShowFindDialog(false);
      notifySuccess('Record loaded successfully');
   };

   const handleSearchFind = () => {
      if (!findSearchText.trim()) {
         notifyWarning('Enter Bill No or Party name to search');
         return;
      }
      // Placeholder: In real implementation, this would fetch from backend
      // For now, we'll show a message
      notifyWarning('Search feature coming soon - Please use bill number');
   };

   const handlePrint = () => {
      if (!printData.lines.length) {
         notifyWarning('Nothing to print — add at least one challan line');
         return;
      }
      setPrintOpen(true);
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!billGpNo || String(billGpNo).trim() === '') {
         notifyWarning('Please enter Bill/GP No.');
         return;
      }
      const receivable = linesWithAmt.filter(l => l.jobId && Number(l.finishMts) > 0);
      if (receivable.length === 0) {
         notifyWarning('Add at least one line with a linked challan and received Finish.Mts');
         return;
      }

      setSaving(true);
      let ok = 0;
      try {
         const totalGst = Number(computedSgstAmt) + Number(computedCgstAmt) + Number(computedIgstAmt);
         for (const line of receivable) {
            const gstShare =
               computedGrossAmt > 0 ? (line.jobAmt / computedGrossAmt) * totalGst : totalGst / receivable.length;
            const payload = {
               jobId: line.jobId,
               receivedQty: Number(line.finishMts) || 0,
               receivedPcs: Number(line.fPcs) || 0,
               charges: Number(line.jobAmt) || 0,
               gstAmount: Number(gstShare.toFixed(2)) || 0,
               billGpNo: billGpNo.trim(),
               workerId: selectedJobPartyId,
               billType: billType,
               receiveDate: receiveDate,
               isFinal: line.isFinal !== false,
            };

            if (isEditMode && line.isEdit) {
               await updateJobReceive(payload);
            } else {
               await receiveFromMill(payload);
            }
            ok += 1;
         }
         notifySuccess(isEditMode ? `Receipt #${billGpNo} updated successfully!` : `Challan(s) received — ${ok} finished lot(s) added to stock!`);
         setBillGpNo('');
         setLines([blankLine()]);
         setIsEditMode(false);
         setActiveTab('View Mill Rec');
         await fetchJobs();
         await fetchInventory();
      } catch (err) {
         notifyError(err, { fallback: ok > 0 ? `Partial save: ${ok} processed, then failed` : 'Failed to save job receipt' });
      } finally {
         setSaving(false);
      }
   };

   return (
      <ErpWindowedModal
         isOpen={isOpen}
         onClose={onClose}
         title={`Mill Receipt [ ${selectedBook || 'PROCESS CHARGE'} ]`}
         windowId="millRec"
         bare
      >
         {({ WindowControls }) => (
            <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 overflow-hidden !max-h-none bg-[#cbd5e1]">
               <ErpBusyOverlay show={bootLoading} message="Loading mill receive…" />
               <ErpBusyOverlay show={!bootLoading && saving} message="Saving receive…" />

               <div className="classic-erp-header shrink-0 flex justify-between items-center bg-[#858178] px-2 py-1 text-white border-b border-[#5e5a52]">
                  <span className="erp-window-title truncate font-bold text-xs flex items-center gap-1.5">
                     Mill Receipt [ {selectedBook || 'PROCESS CHARGE'} ]
                     {isEditMode && (
                        <span className="bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded text-[9px] font-extrabold border border-amber-600 animate-pulse">
                           EDITING #{billGpNo || 'RECEIPT'}
                        </span>
                     )}
                  </span>
                  <WindowControls />
               </div>

               {/* Tab Navigation */}
               <div className="classic-erp-tabs shrink-0 flex bg-[#d4d0c8] p-1 border-b border-[#808080] gap-1">
                  {['Mill Receive', 'View Mill Rec'].map(tab => (
                     <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`classic-erp-tab-button px-3 py-1 text-[10px] font-bold border ${activeTab === tab
                              ? 'bg-[#ffffff] text-black border-[#808080] shadow-sm'
                              : 'bg-transparent text-[#555] border-transparent hover:bg-slate-200'
                           }`}
                     >
                        {tab}
                     </button>
                  ))}
               </div>

               <div className="flex-1 flex flex-col justify-start overflow-hidden bg-[#d4d0c8]">
                  {activeTab === 'Mill Receive' ? (
                     <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
                        
                        {/* SCROLLABLE FORM CONTENT */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">

                        {/* 1. TOP HEADER GRID FORM */}
                        <div className="border border-[#808080] p-2 bg-[#d4d0c8] shadow-[inset_1px_1px_0px_#fff]">
                           <div className="grid grid-cols-12 gap-x-2 gap-y-1.5 text-[11px]">

                              {/* Row 1 */}
                              <div className="col-span-5 flex items-center gap-1">
                                 <span className="w-20 text-slate-800 font-semibold text-right">Job Party:</span>
                                 <ERPSelect
                                    className="classic-erp-select flex-1 bg-white"
                                    value={selectedJobPartyId}
                                    onChange={(e) => {
                                       setSelectedJobPartyId(e.target.value);
                                       setLines([blankLine()]); // switching party invalidates picked challans
                                    }}
                                    options={jobPartyOptions}
                                    placeholder="- Select Job Party -"
                                    recentKey="mill-receive-party"
                                 />
                              </div>
                              <div className="col-span-2 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold">GSTIN:-</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 bg-slate-100 font-mono text-[10px]"
                                    value={gstin}
                                    onChange={(e) => setGstin(e.target.value)}
                                    placeholder=""
                                    disabled
                                 />
                              </div>
                              <div className="col-span-2 flex items-center gap-1">
                                 <span className="text-[10px] text-slate-800 font-semibold leading-tight text-right w-24">Total Process Amt(Party):</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input w-20 text-right bg-slate-100 font-bold"
                                    value={totalProcessAmt}
                                    disabled
                                 />
                              </div>
                              <div className="col-span-1 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold">Serial No:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input w-12 text-center bg-slate-100 font-bold"
                                    value={serialNo}
                                    disabled
                                 />
                              </div>
                              <div className="col-span-2 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold">Date:</span>
                                 <input
                                    type="date"
                                    className="classic-erp-input flex-1 bg-white font-mono"
                                    value={receiveDate}
                                    onChange={(e) => setReceiveDate(e.target.value)}
                                 />
                              </div>

                              {/* Row 2 */}
                              <div className="col-span-3 flex items-center gap-1">
                                 <span className="w-20 text-slate-800 font-semibold text-right">Bill/Gp No:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 bg-white"
                                    value={billGpNo}
                                    onChange={(e) => setBillGpNo(e.target.value)}
                                 />
                              </div>
                              <div className="col-span-3 flex items-center px-1">
                                 <span className="text-red-700 font-bold italic text-[9px]">Click ChlnNo cell (or Alt+L) to pick a challan — Add Line for more</span>
                              </div>
                              <div className="col-span-2 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold text-right w-24">Reverse Charge:</span>
                                 <select
                                    className="classic-erp-select flex-1 bg-white h-[30px] border border-slate-300"
                                    value={reverseCharge}
                                    onChange={(e) => setReverseCharge(e.target.value)}
                                 >
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                 </select>
                              </div>
                              <div className="col-span-2 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold text-right w-16">HSN CD:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 bg-white"
                                    value={hsnCd}
                                    onChange={(e) => setHsnCd(e.target.value)}
                                 />
                              </div>
                              <div className="col-span-2 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold text-right w-12">TYPE:</span>
                                 <select
                                    className="classic-erp-select flex-1 bg-white h-[30px] border border-slate-300"
                                    value={billType}
                                    onChange={(e) => setBillType(e.target.value)}
                                 >
                                    <option value="Process">Process</option>
                                    <option value="Other">Other</option>
                                 </select>
                              </div>

                           </div>
                        </div>

                        {/* 2. TRANSACTION GRID TABLE (multi-row — one line per challan) */}
                        <div className="border border-[#808080] bg-white overflow-x-auto min-h-[140px] max-h-[220px]">
                           <table className="min-w-[1440px] w-full text-[10px] font-mono border-collapse">
                              <thead>
                                 <tr className="bg-[#e2e8f0] text-slate-800 border-b border-[#808080] text-[10px]">
                                    <th className="border-r border-[#808080] p-1 w-10 text-center">SrNo</th>
                                    <th className="border-r border-[#808080] p-1 w-32 text-left">LotNo</th>
                                    <th className="border-r border-[#808080] p-1 w-28 text-left">Chln No</th>
                                    <th className="border-r border-[#808080] p-1 w-48 text-left">ItemName</th>
                                    <th className="border-r border-[#808080] p-1 w-20 text-right">G.Pcs</th>
                                    <th className="border-r border-[#808080] p-1 w-24 text-right">Grey.Mts</th>
                                    <th className="border-r border-[#808080] p-1 w-24 text-right">Finish.Mts</th>
                                    <th className="border-r border-[#808080] p-1 w-24 text-right">Final.Mts</th>
                                    <th className="border-r border-[#808080] p-1 w-20 text-right">Shtg%</th>
                                    <th className="border-r border-[#808080] p-1 w-24 text-right">Job.Rate</th>
                                    <th className="border-r border-[#808080] p-1 w-28 text-right">Job Amount</th>
                                    <th className="border-r border-[#808080] p-1 w-16 text-center">CP</th>
                                    <th className="border-r border-[#808080] p-1 w-16 text-center">Tp</th>
                                    <th className="border-r border-[#808080] p-1 w-40 text-left">Finish Item</th>
                                    <th className="border-r border-[#808080] p-1 w-16 text-center">Cut</th>
                                    <th className="border-r border-[#808080] p-1 w-20 text-right">F.Pcs</th>
                                    <th className="border-r border-[#808080] p-1 w-28 text-left">Proc Type</th>
                                    <th className="border-r border-[#808080] p-1 w-28 text-left">Cutting Pending</th>
                                    <th className="border-r border-[#808080] p-1 w-20 text-right">Pending</th>
                                    <th className="border-r border-[#808080] p-1 w-14 text-center">Final?</th>
                                    <th className="p-1 w-8" />
                                 </tr>
                              </thead>
                              <tbody>
                                 {linesWithAmt.map((line, idx) => (
                                    <tr key={line.id} className="border-b border-slate-200 hover:bg-slate-50">
                                       <td className="border-r border-slate-300 p-1 text-center bg-slate-100 font-bold">{idx + 1}</td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none bg-slate-100 text-slate-500 font-mono"
                                             value={line.lotNo}
                                             readOnly
                                             disabled
                                             placeholder="Auto-filled"
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-chln-no-${idx}`}
                                             type="text"
                                             className="w-full h-6 px-1 border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-sky-100 font-mono cursor-pointer"
                                             value={line.chlnNo}
                                             onChange={(e) => setLineField(idx, 'chlnNo', e.target.value)}
                                             onClick={() => openLotLookup(idx)}
                                             onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                   if (!line.chlnNo || !line.jobId) {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      openLotLookup(idx);
                                                   } else {
                                                      handleChlnNoEnter(e, idx);
                                                   }
                                                }
                                             }}
                                             placeholder="Press Enter or Click..."
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none bg-slate-100 text-slate-700"
                                             value={line.itemName}
                                             disabled
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent"
                                             value={line.gPcs}
                                             onChange={(e) => setLineField(idx, 'gPcs', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent"
                                             value={line.greyMts}
                                             onChange={(e) => setLineField(idx, 'greyMts', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-finish-mts-${idx}`}
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent"
                                             value={line.finishMts}
                                             onChange={(e) => setLineField(idx, 'finishMts', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent"
                                             value={line.finalMts}
                                             onChange={(e) => setLineField(idx, 'finalMts', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none text-right bg-slate-100"
                                             value={lineShortagePct(line)}
                                             disabled
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent font-bold"
                                             value={line.jobRate}
                                             onChange={(e) => setLineField(idx, 'jobRate', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-slate-100 font-bold"
                                             value={line.jobAmt}
                                             disabled
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none text-center bg-transparent"
                                             value={line.cp}
                                             onChange={(e) => setLineField(idx, 'cp', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none text-center bg-transparent"
                                             value={line.tp}
                                             onChange={(e) => setLineField(idx, 'tp', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <select
                                             className="w-full h-6 px-1 border-none bg-transparent text-[10px] focus:outline-none uppercase font-bold"
                                             value={line.finishItem}
                                             onChange={(e) => setLineField(idx, 'finishItem', e.target.value)}
                                          >
                                             <option value="">- Select -</option>
                                             {finishItemOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                             ))}
                                          </select>
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none text-center bg-transparent"
                                             value={line.cut}
                                             onChange={(e) => handleCutChange(idx, e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent"
                                             value={line.fPcs}
                                             onChange={(e) => handleFPcsChange(idx, e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <select
                                             className="w-full h-6 px-1 border-none bg-transparent text-[10px] focus:outline-none"
                                             value={line.procType}
                                             onChange={(e) => setLineField(idx, 'procType', e.target.value)}
                                          >
                                             <option value="">- Select -</option>
                                             <option value="Finish">Finish</option>
                                             <option value="Refinish">Refinish</option>
                                             <option value="Return">Return</option>
                                          </select>
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             className="w-full h-6 px-1 border-none bg-transparent"
                                             value={line.cuttingPending}
                                             onChange={(e) => setLineField(idx, 'cuttingPending', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5 text-right bg-slate-100 text-slate-600" title="Still pending on this challan before this line">
                                          {line.jobId ? Number(line.pendingQty || 0).toFixed(2) : ''}
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5 text-center">
                                          <input
                                             type="checkbox"
                                             checked={line.isFinal !== false}
                                             onChange={(e) => setLineField(idx, 'isFinal', e.target.checked)}
                                             title="Checked: this closes the job (any shortfall books as wastage). Unchecked: more is still expected — job stays Partial."
                                          />
                                       </td>
                                       <td className="p-0.5 text-center">
                                          <button
                                             type="button"
                                             className="text-red-600 hover:text-red-800 disabled:opacity-30"
                                             onClick={() => removeLine(idx)}
                                             title="Remove line"
                                          >
                                             <Trash2 size={12} />
                                          </button>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>

                        <div className="flex justify-start">
                           <button
                              type="button"
                              className="px-3 py-1 text-[10px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1] flex items-center gap-1"
                              onClick={addLine}
                           >
                              <Plus size={11} /> Add Line
                           </button>
                        </div>

                        {/* 3. SUMMARY BAR */}
                        <div className="bg-[#0f766e] text-white text-[11px] font-bold px-3 py-1 flex justify-between items-center uppercase border border-[#0d6059]">
                           <div>TOTAL PCS : {gridTotals.fPcs}</div>
                           <div>Send.Mts : {gridTotals.greyMts.toFixed(2)}</div>
                           <div>Rec.Mts : {gridTotals.finishMts.toFixed(2)}</div>
                           <div>FnsPcs : {gridTotals.fPcs}</div>
                           <div>(Snd.Kgs : 0 &middot; Rec.Kgs : 0)</div>
                        </div>

                        {/* 4. FOOTER MULTI-COLUMN ADJUSTMENTS */}
                        <div className="grid grid-cols-12 gap-2 text-[11px] p-2 border border-[#808080] bg-[#d4d0c8]">

                           {/* Column 1: Adjustments */}
                           <div className="col-span-3 space-y-1.5 border-r border-[#a0a0a0] pr-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-20 text-slate-800 font-semibold text-right">Less:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={lessPercent}
                                    onChange={(e) => handleLessPercentChange(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={lessAmt}
                                    onChange={(e) => setLessAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-20 text-slate-800 font-semibold text-right">Other Less:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={otherLessPercent}
                                    onChange={(e) => handleOtherLessPercentChange(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={otherLessAmt}
                                    onChange={(e) => setOtherLessAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-20 text-slate-800 font-semibold text-right">Other Add:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={otherAddPercent}
                                    onChange={(e) => handleOtherAddPercentChange(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={otherAddAmt}
                                    onChange={(e) => setOtherAddAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1 pt-1 border-t border-slate-300">
                                 <span className="w-20 text-slate-800 font-semibold text-right">Remark:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 bg-white"
                                    value={remark}
                                    onChange={(e) => setRemark(e.target.value)}
                                 />
                              </div>
                           </div>

                           {/* Column 2: TDS Details */}
                           <div className="col-span-2 space-y-1.5 border-r border-[#a0a0a0] px-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-800 font-semibold text-right">On Tds Amount:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={onTdsAmt}
                                    onChange={(e) => setOnTdsAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-800 font-semibold text-right">T.d.s.:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-10 text-center bg-white"
                                    value={tdsPercent}
                                    onChange={(e) => setTdsPercent(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={tdsAmt}
                                    onChange={(e) => setTdsAmt(e.target.value)}
                                 />
                                 <button
                                    type="button"
                                    className="px-1.5 py-0.5 border border-slate-400 bg-slate-100 active:bg-slate-300 font-bold rounded"
                                    onClick={() => setTdsAmt('0.00')}
                                 >
                                    C
                                 </button>
                              </div>
                           </div>

                           {/* Column 3: GST Details */}
                           <div className="col-span-3 space-y-1.5 border-r border-[#a0a0a0] px-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-20 text-slate-800 font-semibold text-right">TaxableAmt:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold"
                                    value={effectiveGstBase.toFixed(2)}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">SGST %:</span>
                                 <input
                                    type="number"
                                    step="0.01"
                                    className="classic-erp-input w-12 text-center bg-white font-bold"
                                    value={sgstPercent}
                                    onChange={(e) => {
                                       const v = e.target.value;
                                       setSgstPercent(v);
                                       if (Number(igstPercent) === 0) setCgstPercent(v);
                                    }}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-mono font-bold"
                                    value={computedSgstAmt}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">CGST %:</span>
                                 <input
                                    type="number"
                                    step="0.01"
                                    className="classic-erp-input w-12 text-center bg-white font-bold"
                                    value={cgstPercent}
                                    onChange={(e) => {
                                       const v = e.target.value;
                                       setCgstPercent(v);
                                       if (Number(igstPercent) === 0) setSgstPercent(v);
                                    }}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-mono font-bold"
                                    value={computedCgstAmt}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">IGST %:</span>
                                 <input
                                    type="number"
                                    step="0.01"
                                    className="classic-erp-input w-12 text-center bg-white font-bold"
                                    value={igstPercent}
                                    onChange={(e) => {
                                       const v = e.target.value;
                                       setIgstPercent(v);
                                       if (Number(v) > 0) {
                                          setSgstPercent('0');
                                          setCgstPercent('0');
                                       }
                                    }}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-mono font-bold"
                                    value={computedIgstAmt}
                                    disabled
                                 />
                              </div>
                           </div>

                           {/* Column 4: Totals Block */}
                           <div className="col-span-4 space-y-1 pl-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Gross Amt:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold"
                                    value={computedGrossAmt.toFixed(2)}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Round Off:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100"
                                    value={computedRoundOff}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right text-yellow-800">RCM GST:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-amber-50 text-amber-900"
                                    value={rcmGst}
                                    onChange={(e) => setRcmGst(e.target.value)}
                                    disabled={reverseCharge !== 'Yes'}
                                 />
                              </div>
                              <div className="flex items-center gap-1 border-t border-slate-300 pt-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Net Amount:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold text-blue-900"
                                    value={computedNetAmt.toFixed(2)}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Final Amount:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold text-red-900"
                                    value={computedFinalAmt}
                                    disabled
                                 />
                              </div>
                           </div>

                        </div>

                        </div>

                        {/* 5. ACTION BUTTONS FOOTER BAR (PINNED AT BOTTOM) */}
                         <div className="shrink-0 flex flex-col gap-1.5 p-2 border-t-2 border-[#808080] bg-[#d4d0c8] shadow-md z-10">

                            {/* Row 1: Primary Toolbar */}
                            <div className="flex justify-start gap-1.5 flex-wrap items-center">
                               <button type="button" onClick={handleNew} className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]" title="New (Alt+N)">New</button>
                               <button 
                                  type="button" 
                                  onClick={() => {
                                     setActiveTab('View Mill Rec');
                                     notifySuccess('Select any receipt from the list below to edit');
                                  }} 
                                  className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]"
                                  title="View and select a receipt to edit"
                               >
                                  Edit
                               </button>
                               <button
                                  type="submit"
                                  onClick={handleSubmit}
                                  disabled={saving || !selectedJobPartyId}
                                  className={`px-6 py-1 text-[11px] font-extrabold border shadow-sm text-white disabled:opacity-50 ${
                                     isEditMode
                                        ? 'border-amber-900 bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                                        : 'border-blue-900 bg-blue-700 hover:bg-blue-800 active:bg-blue-900'
                                  }`}
                               >
                                  <SaveButtonLabel saving={saving} idle={isEditMode ? "Update" : "Save"} busy={isEditMode ? "Updating…" : "Saving…"} />
                               </button>
                               <button type="button" onClick={onClose} className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Cancel</button>
                               <button type="button" onClick={handleOpenFindModal} className="px-5 py-1 text-[11px] font-bold bg-amber-100 border-amber-400 text-amber-900 active:bg-amber-200" title="Quick Find Receipt (F3 / Alt+F)">Find (F3)</button>
                               <button type="button" onClick={handleOpenFindModal} className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Sp.Find</button>
                               <button type="button" onClick={() => notifyWarning('Select a record to delete')} className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1] text-red-800">Delete</button>
                               <button type="button" onClick={onClose} className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Exit</button>
                            </div>

                            {/* Row 2: Navigation & Custom Action Buttons */}
                            <div className="flex justify-between items-center flex-wrap gap-2">
                               <div className="flex gap-1">
                                  <button type="button" className="px-3 py-0.5 text-[10px] border border-slate-400 bg-[#f1f5f9] active:bg-[#e2e8f0]">First</button>
                                  <button type="button" className="px-3 py-0.5 text-[10px] border border-slate-400 bg-[#f1f5f9] active:bg-[#e2e8f0]">Next</button>
                                  <button type="button" className="px-3 py-0.5 text-[10px] border border-slate-400 bg-[#f1f5f9] active:bg-[#e2e8f0]">PriV</button>
                                  <button type="button" className="px-3 py-0.5 text-[10px] border border-slate-400 bg-[#f1f5f9] active:bg-[#e2e8f0]">Last</button>
                               </div>

                               <div className="flex gap-1.5">
                                  <button type="button" className="px-4 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Close Bill</button>
                                  <button
                                     type="button"
                                     onClick={() => {
                                        if (onOpenPayment) onOpenPayment(selectedJobPartyId);
                                        else notifyWarning('Open Transaction > Bank Payment / Cash Payment to make payment');
                                     }}
                                     className="px-4 py-1 text-[11px] font-bold border border-red-400 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200"
                                  >
                                     Payment Entry
                                  </button>
                                  <button type="button" onClick={handlePrint} className="px-4 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Print</button>
                               </div>
                            </div>

                         </div>

                      </div>
                   ) : (
                      // View Mill Rec list tab
                      <div className="flex-1 flex flex-col overflow-hidden bg-white border border-[#808080]">
                         <div className="bg-amber-50 text-amber-900 px-3 py-1.5 text-[11px] font-semibold border-b border-amber-200 flex justify-between items-center shrink-0">
                            <span>💡 <strong>Click any row below</strong> to open and edit this receipt in the form.</span>
                            <span className="text-[10px] text-slate-500 font-mono">Total Receipts: {receivedJobs.length}</span>
                         </div>
                         <div className="classic-erp-table-container flex-1">
                            <table className="classic-erp-table">
                               <thead>
                                  <tr>
                                     <th className="w-24">Date</th>
                                     <th className="w-32">Job Card No</th>
                                     <th className="w-28">Bill/Gp No</th>
                                     <th>Mill Partner</th>
                                     <th className="w-28">Process</th>
                                     <th className="w-28 text-right">Issued Qty</th>
                                     <th className="w-28 text-right">Received Qty</th>
                                     <th className="w-28 text-right">Wastage Qty</th>
                                     <th className="w-24 text-center">Status</th>
                                     <th className="w-16 text-center">Action</th>
                                  </tr>
                               </thead>
                               <tbody>
                                  {receivedJobs.map((job) => (
                                     <tr 
                                        key={job._id}
                                        onClick={() => handleLoadReceivedJob(job)}
                                        className="cursor-pointer hover:bg-amber-100/70 hover:text-blue-950 transition-colors select-none group"
                                        title="Click to open and edit this receipt in form"
                                     >
                                        <td className="font-mono">{job.receiveDate ? new Date(job.receiveDate).toLocaleDateString() : 'N/A'}</td>
                                        <td className="font-bold text-blue-900 group-hover:underline">{job.jobCardNo}</td>
                                        <td className="font-mono text-slate-700 font-semibold">{job.billGpNo || '—'}</td>
                                        <td className="font-bold uppercase">{job.workerId?.name || 'N/A'}</td>
                                        <td className="uppercase font-mono text-slate-700">{job.processType}</td>
                                        <td className="text-right font-mono">{job.issueQty} Mts</td>
                                        <td className="text-right font-mono font-bold text-green-800">{job.receivedQty} Mts</td>
                                        <td className="text-right font-mono font-bold text-red-800">{job.wastage} Mts</td>
                                        <td className="text-center font-bold">
                                           <span className="px-1 bg-black text-white text-[9px] uppercase">
                                              {job.status}
                                           </span>
                                        </td>
                                        <td className="text-center">
                                           <button
                                              type="button"
                                              onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleLoadReceivedJob(job);
                                              }}
                                              className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-xs"
                                           >
                                              Edit
                                           </button>
                                        </td>
                                     </tr>
                                  ))}
                                  {receivedJobs.length === 0 && (
                                     <tr>
                                        <td colSpan="10" className="py-8 text-center text-slate-400 font-bold uppercase">
                                           No Received Receipts Found
                                        </td>
                                     </tr>
                                  )}
                               </tbody>
                            </table>
                         </div>
                      </div>
                   )}
                </div>

                {/* Classic ERP Lot Lookup Dialog Sub-Window */}
                {showLotDropdown && selectedJobPartyId && createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
                     <div
                        ref={dropdownRef}
                        tabIndex={0}
                        onKeyDown={handleDropdownKeyDown}
                        className="w-[580px] bg-[#d4d0c8] border-2 border-white border-r-[#808080] border-b-[#808080] shadow-md flex flex-col font-mono text-[11px] outline-none"
                     >

                        {/* Dialog Header */}
                        <div className="bg-[#858178] px-2 py-1 text-white font-bold flex justify-between items-center select-none">
                           <span>Select Challan [ Associated Mill Issues ]</span>
                           <button
                              type="button"
                              onClick={() => setShowLotDropdown(false)}
                              className="w-4 h-4 bg-[#d4d0c8] text-black border border-white border-r-[#808080] border-b-[#808080] text-center font-bold leading-tight hover:bg-slate-100 flex items-center justify-center active:border-r-white active:border-b-white"
                           >
                              &times;
                           </button>
                        </div>

                        {/* Dialog Body */}
                        <div className="p-2 space-y-2">
                           <div className="text-[10px] text-red-800 font-bold mb-1">
                              Arrow keys to Navigate &middot; Enter to Select &middot; ESC to Close
                           </div>
                           <div className="border border-[#808080] bg-white max-h-[250px] overflow-y-auto">
                              <table className="w-full text-left border-collapse text-[11px]">
                                 <thead>
                                    <tr className="bg-[#e2e8f0] border-b border-[#808080] text-slate-800 font-bold">
                                       <th className="p-1 border-r border-[#808080]">Challan No</th>
                                       <th className="p-1 border-r border-[#808080]">Lot Number</th>
                                       <th className="p-1 border-r border-[#808080]">Item Name</th>
                                       <th className="p-1 border-r border-[#808080] text-right">Issued Qty</th>
                                       <th className="p-1 border-r border-[#808080] text-right">Received So Far</th>
                                       <th className="p-1 text-right">Pending</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {associatedLots.length > 0 ? (
                                       associatedLots.map((job, i) => (
                                          <tr
                                             key={job._id}
                                             onClick={() => {
                                                if (lookupTargetIdx != null) handleSelectLot(job, lookupTargetIdx);
                                                setShowLotDropdown(false);
                                             }}
                                             onMouseEnter={() => setDropdownSelectIdx(i)}
                                             className={`border-b border-slate-200 cursor-pointer ${i === dropdownSelectIdx ? 'bg-blue-600 text-white' : 'hover:bg-sky-100 text-slate-900'}`}
                                          >
                                             <td className={`p-1.5 border-r border-slate-200 font-bold ${i === dropdownSelectIdx ? 'text-white' : 'text-blue-900'}`}>{job.challanNo || job.jobCardNo}</td>
                                             <td className="p-1.5 border-r border-slate-200">{job.lotId?.lotId || job.lotId || 'N/A'}</td>
                                             <td className="p-1.5 border-r border-slate-200 uppercase font-sans">{job.lotId?.itemId?.name || job.lotId?.itemName || 'N/A'}</td>
                                             <td className="p-1.5 border-r border-slate-200 text-right">{job.issueQty} Mts</td>
                                             <td className="p-1.5 border-r border-slate-200 text-right">{Number(job.receivedQty || 0)} Mts</td>
                                             <td className="p-1.5 text-right font-bold">{jobPending(job).qty.toFixed(2)} Mts</td>
                                          </tr>
                                       ))
                                    ) : (
                                       <tr>
                                          <td colSpan="4" className="p-4 text-center text-slate-400 italic">No associated lots found.</td>
                                       </tr>
                                    )}
                                 </tbody>
                              </table>
                           </div>
                        </div>

                        {/* Dialog Footer */}
                        <div className="p-2 border-t border-[#808080] flex justify-end gap-1">
                           <button
                              type="button"
                              onClick={() => setShowLotDropdown(false)}
                              className="px-4 py-1 font-bold border border-slate-400 bg-white active:bg-slate-200"
                           >
                              Close
                           </button>
                        </div>

                     </div>
                  </div>,
                  document.body
               )}

               {/* Quick Mill Receive Number Find Modal with + / - and Enter -> Edit */}
                {showFindDialog && (
                   <div
                      className="fixed inset-0 bg-black/60 z-[10070] flex items-center justify-center p-4"
                      onClick={() => setShowFindDialog(false)}
                   >
                      <div
                         className="bg-white rounded-lg shadow-2xl border-2 border-slate-700 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                         onClick={(e) => e.stopPropagation()}
                         style={{ maxHeight: '82vh' }}
                      >
                         {/* Header */}
                         <div className="bg-[#1a3353] text-white px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <span className="bg-amber-400 text-slate-900 font-black px-1.5 py-0.5 rounded text-[11px]">FIND RECEIPT</span>
                               <h3 className="font-bold text-xs uppercase tracking-wider">Quick Receive Selector</h3>
                            </div>
                            <span className="text-[10px] text-slate-300">
                               <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">+</kbd> / <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">-</kbd> change · <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">Enter</kbd> Edit
                            </span>
                         </div>

                         {/* Search / Quick Number Input */}
                         <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 shrink-0">Bill/GP No:</span>
                            <input
                               ref={findInputRef}
                               type="text"
                               autoFocus
                               value={findSearchText}
                               onChange={(e) => {
                                  setFindSearchText(e.target.value);
                                  setFindActiveIdx(0);
                               }}
                               onKeyDown={handleFindKeyDown}
                               placeholder="Type number (1, 2, 3...) or press + / - to change..."
                               className="flex-1 px-3 py-1.5 border-2 border-blue-600 rounded text-sm font-bold bg-[#fffde6] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono shadow-inner"
                            />
                            <span className="text-[11px] font-bold text-slate-600 shrink-0">{filteredReceivedJobs.length} Records</span>
                         </div>

                         {/* Numbers List */}
                         <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-72 bg-slate-50">
                            {filteredReceivedJobs.length === 0 ? (
                               <div className="text-center py-10 text-xs text-slate-500 font-medium">
                                  No receipts found matching &quot;{findSearchText}&quot;
                                </div>
                            ) : (
                               filteredReceivedJobs.map((j, idx) => {
                                  const isSelected = idx === findActiveIdx;
                                  const cleanNo = String(j.billGpNo || j.jobCardNo || idx + 1);
                                  return (
                                     <div
                                        key={j._id || j.id || idx}
                                        onClick={() => handleLoadReceivedJob(j)}
                                        className={`px-3 py-2 rounded flex items-center justify-between cursor-pointer text-xs transition-all ${
                                           isSelected
                                              ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-300'
                                              : 'hover:bg-slate-200 text-slate-800 bg-white border border-slate-200'
                                        }`}
                                     >
                                        <div className="flex items-center gap-3">
                                           <span className={`text-sm font-black font-mono px-2 py-0.5 rounded ${isSelected ? 'bg-amber-400 text-slate-900 shadow-sm' : 'bg-slate-200 text-slate-900'}`}>
                                              #{cleanNo}
                                           </span>
                                           <div>
                                              <div className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                 {j.workerId?.name || 'Mill / Job Worker'}
                                              </div>
                                              <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                 {j.receiveDate ? new Date(j.receiveDate).toLocaleDateString('en-IN') : '—'} · {j.lotId?.itemName || 'Item'} · {Number(j.receivedQty || 0).toFixed(2)} mts
                                              </div>
                                           </div>
                                        </div>
                                        <div className="text-right font-mono font-bold">
                                           <div>{Number(j.fPcs || j.issuePcs || 0)} pcs</div>
                                           {isSelected && (
                                              <span className="text-[9px] bg-white/25 px-1.5 py-0.5 rounded text-white font-semibold uppercase tracking-wider">
                                                 ↵ Enter → Edit
                                              </span>
                                           )}
                                        </div>
                                     </div>
                                  );
                               })
                            )}
                         </div>

                         {/* Footer Navigation Bar */}
                         <div className="bg-slate-200 px-3 py-2 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-700">
                            <span className="flex items-center gap-1 font-medium">
                               <kbd className="bg-white border px-1 rounded font-bold font-mono">+</kbd> Next · <kbd className="bg-white border px-1 rounded font-bold font-mono">-</kbd> Prev · <kbd className="bg-white border px-1 rounded font-bold font-mono">↑↓</kbd> Select
                            </span>
                            <div className="flex gap-2">
                               <button
                                  type="button"
                                  onClick={() => setShowFindDialog(false)}
                                  className="px-3 py-1 bg-white border border-slate-400 rounded text-xs hover:bg-slate-100 font-semibold"
                               >
                                  Cancel (Esc)
                               </button>
                               <button
                                  type="button"
                                  onClick={() => {
                                     const job = filteredReceivedJobs[findActiveIdx];
                                     if (job) handleLoadReceivedJob(job);
                                  }}
                                  disabled={!filteredReceivedJobs.length}
                                  className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700 shadow-sm"
                               >
                                  Open in Edit (Enter)
                               </button>
                            </div>
                         </div>
                      </div>
                   </div>
                )}

               {printOpen && (
                  <JobWorkPrint variant="millReceive" data={printData} onClose={() => setPrintOpen(false)} />
               )}

            </div>
         )}
      </ErpWindowedModal>
   );
};

export default ReceiveModal;
