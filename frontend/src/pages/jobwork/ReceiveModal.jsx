import React, { useState, useEffect, useMemo, useRef } from 'react';
import ErpTopLayer from '../../components/erp/ErpTopLayer';
import { createPortal } from 'react-dom';
import { ERPSelect } from '../../components/forms/FormElements';
import { focusNextField } from '../../utils/formEnterNavigation';
import AccountMasterModal from '../masters/AccountMasterModal';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirmDeleteLine } from '../../utils/confirm';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import JobWorkPrint from '../../components/print/JobWorkPrint';
import { Plus, Trash2 } from 'lucide-react';
import { lineShortagePct, lineShtgKgs, lineJobAmt, UNIT_PQ } from './millReceiveCalc';

const today = () => new Date().toISOString().substring(0, 10);

/** One grid row = one Mill Issue challan being received against this bill. */
const blankLine = () => ({
   id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
   srNo: 1,
   jobId: '',
   lotNo: '',
   chlnNo: '',
   itemName: '',
   perKgs: '0.00',
   gPcs: '0',
   greyMts: '0.00',
   greyKgs: '0.000',
   recKgs: '0.000',
   f1Pcs: '0',
   finishMts: '0.00',
   finalMts: '0.00',
   jobRate: '0.00',
   unitPQ: 'Q',
   desc1: '',
   desc2: '',
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

/** Challan balance in grey returned (JSM); receipts saved before grey was recorded use finish. */
const jobPending = (job) => {
   const issueQty = Number(job?.issueQty || 0);
   const issuePcs = Number(job?.issuePcs || 0);
   const recQty = Number(job?.receivedGreyQty ?? job?.receivedQty ?? 0);
   const recPcs = Number(job?.receivedGreyPcs ?? job?.receivedPcs ?? 0);
   return {
      qty: Math.max(0, Number((issueQty - recQty).toFixed(4))),
      pcs: Math.max(0, issuePcs - recPcs),
   };
};



const ReceiveModal = ({ isOpen, onClose, selectedBook = null, onOpenPayment = null, initialJobId = null }) => {
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
   const [mode, setMode] = useState('View'); // 'View' | 'Add' | 'Edit'
   const [isEditMode, setIsEditMode] = useState(false);
   const [activeReceiptKey, setActiveReceiptKey] = useState('');

   // Header (bill-level — shared across every line in this receipt)
   const [selectedJobPartyId, setSelectedJobPartyId] = useState('');
   const [accountModal, setAccountModal] = useState(null);
   const [gstin, setGstin] = useState('');
   const [billGpNo, setBillGpNo] = useState('');
   const [reverseCharge, setReverseCharge] = useState('No');
   const [hsnCd, setHsnCd] = useState('');
   const [billType, setBillType] = useState('Process');
   const [dueDays, setDueDays] = useState('');
   const [dueDate, setDueDate] = useState('');
   const [serialNo, setSerialNo] = useState('1');
   const [receiveDate, setReceiveDate] = useState(today());
   const [rConDt, setRConDt] = useState('');
   const [bill2A, setBill2A] = useState('');

   // Multi-row grid — one row per challan being received into this bill
   const [lines, setLines] = useState([blankLine()]);
   const [showKgsCols, setShowKgsCols] = useState(false);
   const [selectedRowIdx, setSelectedRowIdx] = useState(0);

   const [printOpen, setPrintOpen] = useState(false);
   const [showLotDropdown, setShowLotDropdown] = useState(false);
   const [lookupTargetIdx, setLookupTargetIdx] = useState(null);
   const [dropdownSelectIdx, setDropdownSelectIdx] = useState(0);
   const dropdownRef = React.useRef(null);
   const associatedLotsRef = useRef([]);
   const lookupTargetIdxRef = useRef(null);
   const dropdownSelectIdxRef = useRef(0);

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
   const kbRef = useRef({ isEditMode: false, mode: 'View' });

   const sortedReceivedJobs = useMemo(() => {
      const list = (jobWorkEntries || []).filter(j => j.status === 'Received' || j.status === 'Partial');
      return list.sort((a, b) => {
         const numA = parseInt(String(a.serialNo || '').replace(/\D/g, ''), 10);
         const numB = parseInt(String(b.serialNo || '').replace(/\D/g, ''), 10);
         if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
         return new Date(a.receiveDate || a.updatedAt || a.createdAt || 0) - new Date(b.receiveDate || b.updatedAt || b.createdAt || 0);
      });
   }, [jobWorkEntries]);

   const receiptBills = useMemo(() => {
      const seen = new Set();
      const bills = [];
      for (const job of sortedReceivedJobs) {
         const key = String(job.billGpNo || '').trim() || String(job._id || job.id || '');
         if (!key || seen.has(key)) continue;
         seen.add(key);
         bills.push(job);
      }
      return bills;
   }, [sortedReceivedJobs]);

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

   const receiptKeyOf = (job) => String(job?.billGpNo || '').trim() || String(job?._id || job?.id || '');

   const handleLoadReceivedJob = (job, options = {}) => {
      if (!job) return;
      const asView = options.asView !== false;
      setActiveReceiptKey(receiptKeyOf(job));
      const workerId = job.workerId?._id || job.workerId || '';
      setSelectedJobPartyId(workerId);
      const workerParty = (parties || []).find(p => String(p._id || p.id) === String(workerId));
      setGstin(job.workerId?.gstin || workerParty?.gstin || '');
      setBillGpNo(job.billGpNo || '');
      const rawSerial = String(job.serialNo || '').replace(/\D/g, '');
      let loadedSerial = rawSerial;
      const billNoClean = String(job.billGpNo || '').replace(/\D/g, '');
      if (!loadedSerial || (loadedSerial === billNoClean && Number(loadedSerial) > 50 && receiptBills.length < 50)) {
         const idx = receiptBills.findIndex(b => receiptKeyOf(b) === receiptKeyOf(job));
         loadedSerial = idx >= 0 ? String(idx + 1) : '1';
      }
      setSerialNo(loadedSerial);
      setReceiveDate(job.receiveDate ? String(job.receiveDate).slice(0, 10) : today());
      setBillType(job.billType || 'Process');

      // Find all sibling jobs that were received under the same billGpNo, so multi-line bills load completely
      const allJobs = options.jobsList || jobWorkEntries || [];
      const siblingJobs = job.billGpNo
         ? allJobs.filter(j => j.billGpNo && String(j.billGpNo).trim().toLowerCase() === String(job.billGpNo).trim().toLowerCase() && (j.status === 'Received' || j.status === 'Partial'))
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
            // Receipts saved with grey keep their own figures; older ones load exactly as before
            // (grey = issued, final = finish) with basis F so their job amount is unchanged.
            gPcs: String(j.receivedGreyPcs ?? j.issuePcs ?? '0'),
            greyMts: Number(j.receivedGreyQty ?? j.issueQty ?? 0).toFixed(2),
            greyKgs: Number(j.receivedGreyKgs || 0).toFixed(3),
            recKgs: Number(j.receivedKgs || 0).toFixed(3),
            perKgs: Number(j.perKgs || 0).toFixed(2),
            f1Pcs: String(j.receivedPcs || j.fPcs || j.issuePcs || '0'),
            finishMts: Number(j.receivedQty || 0).toFixed(2),
            finalMts: Number(j.receivedGreyQty != null ? (j.receivedFinalQty || 0) : (j.receivedQty || 0)).toFixed(2),
            fPcs: String(j.receivedPcs || j.fPcs || j.issuePcs || '0'),
            unitPQ: j.jobUnit || (j.receivedGreyQty == null && Number(j.receivedQty) > 0 ? 'F' : 'Q'),
            desc1: j.receiveDesc1 || '',
            desc2: j.receiveDesc2 || '',
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

      if (asView) {
         setMode('View');
         setIsEditMode(false);
         kbRef.current.isEditMode = false;
         kbRef.current.mode = 'View';
      } else {
         setMode('Edit');
         setIsEditMode(true);
         kbRef.current.isEditMode = true;
         kbRef.current.mode = 'Edit';
      }
      setShowFindDialog(false);
      setActiveTab('Mill Receive');
   };

   const navigateReceipt = (dir) => {
      const list = receiptBills;
      if (!list.length) {
         notifyWarning('No saved receipts to browse');
         return;
      }
      if (dir === 'first') {
         handleLoadReceivedJob(list[0], { asView: true });
         focusSerialNo();
         return;
      }
      if (dir === 'last') {
         handleLoadReceivedJob(list[list.length - 1], { asView: true });
         focusSerialNo();
         return;
      }
      const currentIdx = list.findIndex((j) => receiptKeyOf(j) === activeReceiptKey);
      let nextIdx = currentIdx + dir;
      if (currentIdx === -1) nextIdx = dir > 0 ? 0 : list.length - 1;
      if (nextIdx >= 0 && nextIdx < list.length && nextIdx !== currentIdx) {
         handleLoadReceivedJob(list[nextIdx], { asView: true });
         focusSerialNo();
      } else if (nextIdx >= list.length && dir > 0) {
         handleNew();
      } else if (nextIdx < 0 && dir < 0) {
         notifyWarning('Already at the first receipt');
         focusSerialNo();
      }
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
      const state = useStore.getState();
      const existingJobs = state.jobWorkEntries || [];
      const hasBasicMasters = (state.parties || []).length > 0 && (state.items || []).length > 0;

      if (!hasBasicMasters) {
         setBootLoading(true);
      } else {
         setBootLoading(false);
      }

      // 1. Instant load from store if available
      const list = existingJobs
         .filter((j) => j.status === 'Received' || j.status === 'Partial')
         .sort((a, b) => {
            const numA = parseInt(String(a.serialNo || '').replace(/\D/g, ''), 10);
            const numB = parseInt(String(b.serialNo || '').replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
            return new Date(a.receiveDate || a.updatedAt || a.createdAt || 0) - new Date(b.receiveDate || b.updatedAt || b.createdAt || 0);
         });
      const latest = list[list.length - 1];
      // opened from a ledger row: that bill's challan, otherwise the latest receipt
      const wanted = initialJobId ? existingJobs.find((j) => String(j._id || j.id) === String(initialJobId)) : null;
      if (wanted) {
         handleLoadReceivedJob(wanted, { asView: true });
      } else if (latest) {
         handleLoadReceivedJob(latest, { asView: true });
      } else {
         handleNew();
      }
      focusSerialNo();

      // 2. Background refresh
      const backgroundTasks = [];
      if (!(state.parties || []).length) backgroundTasks.push(fetchParties?.());
      if (!(state.items || []).length) backgroundTasks.push(fetchItems?.());
      backgroundTasks.push(fetchJobs());
      backgroundTasks.push(fetchInventory?.());

      Promise.all(backgroundTasks)
         .then(() => {
            if (cancelled) return;
            const freshState = useStore.getState();
            if (!list.length && freshState.jobWorkEntries?.length) {
               const freshList = freshState.jobWorkEntries
                  .filter((j) => j.status === 'Received' || j.status === 'Partial')
                  .sort((a, b) => {
                     const numA = parseInt(String(a.serialNo || '').replace(/\D/g, ''), 10);
                     const numB = parseInt(String(b.serialNo || '').replace(/\D/g, ''), 10);
                     if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
                     return new Date(a.receiveDate || a.updatedAt || a.createdAt || 0) - new Date(b.receiveDate || b.updatedAt || b.createdAt || 0);
                  });
               const freshLatest = freshList[freshList.length - 1];
               if (freshLatest) handleLoadReceivedJob(freshLatest, { asView: true });
            }
         })
         .catch(() => { })
         .finally(() => {
            if (!cancelled) setBootLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, [isOpen, initialJobId]);

   useEffect(() => {
      if (!isOpen) return undefined;

      const onKeyDown = (e) => {
         const kb = kbRef.current;
         if (kb.showFindDialog || kb.showLotDropdown) return;
         if (e.target instanceof Element && e.target.closest('[data-book-selection-modal], [data-account-modal], .erp-confirm-dialog')) return;

         if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'f')) {
            e.preventDefault();
            e.stopPropagation();
            kb.openFind?.();
            return;
         }

         if ((e.altKey && e.key.toLowerCase() === 'e') || e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();
            kb.handleEdit?.();
            return;
         }

         const isMinus = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus' || e.key === 'PageUp';
         const isPlus = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal' || e.key === 'PageDown';
         if ((isMinus || isPlus) && !e.ctrlKey && !e.altKey) {
            const el = e.target;
            const isSerialInput = el && el.id === 'mill-rec-serial';
            const inTextEdit = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !isSerialInput && kb.mode !== 'View';

            // Navigate if on Serial No, or in View mode, or outside text editing fields
            if (isSerialInput || kb.mode === 'View' || !inTextEdit) {
               e.preventDefault();
               e.stopPropagation();
               kb.navigate?.(isMinus ? -1 : 1);
               return;
            }
         }
         if (e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            e.stopPropagation();
            kb.openLot?.(0);
            return;
         }
         if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            e.stopImmediatePropagation();
            kb.handleNew?.();
            return;
         }

         // Enter in View / Browse mode starts a new entry with next Sr No
         if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            const el = e.target;
            const inCombobox = el?.closest?.('[data-erp-combobox]');
            const inGrid = el?.closest?.('.classic-erp-table');
            if (kb.mode === 'View' && !inCombobox && !inGrid) {
               e.preventDefault();
               e.stopPropagation();
               kb.handleNew?.();
               setTimeout(() => {
                  const d = document.getElementById('mill-rec-date');
                  d?.focus();
                  try { d?.select(); } catch {}
               }, 60);
               return;
            }
         }
      };

      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
   }, [isOpen]);

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

   const pendingJobs = useMemo(() => {
      return (jobWorkEntries || []).filter(j => {
         const s = String(j.status || '').toLowerCase();
         if (s === 'cancelled') return false;
         if (s === 'received') return false; // Fully received — do not show in popup
         const p = jobPending(j);
         // Only show if pending qty OR pcs is still remaining
         if (p.qty > 0.001 || p.pcs > 0) return true;
         return false; // Pending balance is 0 — fully received, hide from popup
      });
   }, [jobWorkEntries]);

   // Check if the current billGpNo is already used in an existing receipt (excluding current receipt in edit mode)
   const duplicateBillInfo = useMemo(() => {
      const clean = String(billGpNo || '').trim().toLowerCase();
      if (!clean) return null;
      const cleanSerial = String(serialNo || '').trim();

      const match = (jobWorkEntries || []).find(j => {
         const jBill = String(j.billGpNo || '').trim().toLowerCase();
         if (!jBill || jBill !== clean) return false;
         const jStatus = String(j.status || '').toLowerCase();
         if (jStatus !== 'received' && jStatus !== 'partial') return false;
         if (activeReceiptKey && receiptKeyOf(j) === activeReceiptKey) return false;
         const jSerial = String(j.serialNo || '').trim();
         if (mode === 'Edit' && cleanSerial && jSerial === cleanSerial) return false;
         return true;
      });

      if (!match) return null;
      return {
         billGpNo: match.billGpNo,
         serialNo: match.serialNo,
         partyName: match.workerId?.name || match.workerName || 'Party',
         date: match.receiveDate ? String(match.receiveDate).slice(0, 10) : '',
      };
   }, [billGpNo, serialNo, mode, activeReceiptKey, jobWorkEntries]);

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

   const selectedParty = useMemo(
      () => (parties || []).find((p) => String(p._id || p.id) === String(selectedJobPartyId)) || null,
      [parties, selectedJobPartyId]
   );
   const partyAddress = [selectedParty?.address, selectedParty?.address2, selectedParty?.city].filter(Boolean).join(', ');

   const millBalance = useMemo(() => {
      if (!selectedParty) return null;
      return Number(selectedParty.closingBalance ?? selectedParty.balance ?? 0);
   }, [selectedParty]);

   const openNewParty = (search = '') => {
      setAccountModal({ name: search || '', group: 'JOB WORKER' });
   };

   const handleAccountSuccess = (newAccount) => {
      const id = newAccount?._id || newAccount?.id || '';
      if (id) {
         setSelectedJobPartyId(id);
         setGstin(newAccount?.gstin || '');
         setLines([blankLine()]);
      }
      setAccountModal(null);
      setTimeout(() => {
         const el = document.getElementById('mill-rec-party');
         if (el) focusNextField(el);
      }, 120);
   };

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
      if (!q || targetLine?.jobId) {
         const billQ = String(billGpNo || '').trim().toLowerCase();
         if (billQ) {
            return [...available].sort((a, b) => {
               const aMatch = String(a.challanNo || a.jobCardNo || '').toLowerCase() === billQ;
               const bMatch = String(b.challanNo || b.jobCardNo || '').toLowerCase() === billQ;
               if (aMatch && !bMatch) return -1;
               if (!aMatch && bMatch) return 1;
               return 0;
            });
         }
         return available;
      }
      const filtered = available.filter(j => {
         const lotVal = String(j.lotId?.lotId || j.lotId || '').toLowerCase();
         const chlnVal = String(j.jobCardNo || j.challanNo || '').toLowerCase();
         const itemVal = String(j.lotId?.itemId?.name || j.lotId?.itemName || '').toLowerCase();
         return lotVal.includes(q) || chlnVal.includes(q) || itemVal.includes(q);
      });
      return filtered.length > 0 ? filtered : available;
   }, [partyPendingJobs, pendingJobs, lines, lookupTargetIdx, usedJobIds, billGpNo]);

   associatedLotsRef.current = associatedLots;
   lookupTargetIdxRef.current = lookupTargetIdx;
   dropdownSelectIdxRef.current = dropdownSelectIdx;

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
         if (key === 'f1Pcs' && !(Number(line.cut) > 0)) line.fPcs = value;

         // Auto-adjust isFinal if quantity or pcs is less than pending
         if (line.jobId && ['greyMts', 'gPcs', 'finishMts', 'fPcs'].includes(key)) {
            const pQty = Number(line.pendingQty || 0);
            const pPcs = Number(line.pendingPcs || 0);
            const enteredGrey = Number(key === 'greyMts' ? value : line.greyMts) || 0;
            const enteredPcs = Number(key === 'gPcs' ? value : line.gPcs) || 0;
            if (pQty > 0 || pPcs > 0) {
               const isComplete = enteredGrey >= (pQty - 0.05) && (pPcs <= 0 || enteredPcs >= pPcs);
               line.isFinal = isComplete;
            }
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

   const getNextSerialNo = React.useCallback(() => {
      const list = Array.isArray(jobWorkEntries) ? jobWorkEntries : [];
      let maxNo = 0;
      list.forEach((j) => {
         const num = parseInt(String(j.serialNo || '').replace(/\D/g, ''), 10);
         const bNum = parseInt(String(j.billGpNo || '').replace(/\D/g, ''), 10);
         if (!isNaN(num) && num > maxNo && num < 100000 && !(num === bNum && num > 50)) {
            maxNo = num;
         }
      });
      const validReceipts = (receiptBills || []).filter(b => b.billGpNo || b.status === 'Received');
      const distinctCount = validReceipts.length || 0;
      const nextVal = Math.max(maxNo, distinctCount) + 1;
      return String(nextVal > 0 ? nextVal : 1);
   }, [jobWorkEntries, receiptBills]);

   const addLine = () => setLines(prev => [...prev, { ...blankLine(), srNo: prev.length + 1 }]);

   const removeLine = async (idx) => {
      const ok = await erpConfirmDeleteLine();
      if (!ok) return;
      setLines(prev => (prev.length <= 1 ? [blankLine()] : prev.filter((_, i) => i !== idx)));
   };

   const openLotLookup = (idx) => {
      if (!selectedJobPartyId) {
         notifyWarning('Please select a Job Party first');
         setTimeout(() => {
            document.getElementById('mill-rec-party')?.focus();
         }, 80);
         return;
      }
      setLookupTargetIdx(idx);
      lookupTargetIdxRef.current = idx;
      setDropdownSelectIdx(0);
      dropdownSelectIdxRef.current = 0;
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
            itemName: job.lotId?.itemId?.name || job.lotId?.itemName || job.itemName || '',
            cp: 'C',
            cuttingPending: 'P',
            procType: 'Finish',
            gPcs: String(pending.pcs),
            greyMts: pending.qty.toFixed(2),
            greyKgs: '0.000',
            recKgs: '0.000',
            perKgs: '0.00',
            f1Pcs: String(pending.pcs),
            finishMts: '0.00',
            finalMts: '0.00',
            fPcs: String(pending.pcs),
            unitPQ: ['Q', 'P', 'K', 'G', 'F'].includes(job.jobUnit) ? job.jobUnit : 'Q',
            desc1: '',
            desc2: '',
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

      // Move forward directly to Item Name (or custom focus field) so user can edit or Enter-navigate
      const focusFieldId = options.focusField || `grid-item-${idx}`;
      setTimeout(() => {
         const el = document.getElementById(focusFieldId);
         if (el) {
            el.focus();
            try { el.select(); } catch {}
         }
      }, 80);
   };

   const handleChlnNoEnter = (e, idx) => {
      if (!selectedJobPartyId) {
         notifyWarning('Please select a Job Party first');
         setTimeout(() => {
            document.getElementById('mill-rec-party')?.focus();
         }, 80);
         return;
      }
      const typedChln = String(lines[idx]?.chlnNo || '').trim();
      if (!typedChln) {
         e.preventDefault();
         e.stopPropagation();
         setLookupTargetIdx(idx);
         lookupTargetIdxRef.current = idx;
         setDropdownSelectIdx(0);
         dropdownSelectIdxRef.current = 0;
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
         handleSelectLot(matches[0], idx, { focusField: `grid-item-${idx}` });
         notifySuccess(`Loaded Challan ${matches[0].challanNo || matches[0].jobCardNo}`);
      } else if (matches.length > 1) {
         e.preventDefault();
         e.stopPropagation();
         setLookupTargetIdx(idx);
         lookupTargetIdxRef.current = idx;
         setDropdownSelectIdx(0);
         dropdownSelectIdxRef.current = 0;
         setShowLotDropdown(true);
      } else {
         e.preventDefault();
         e.stopPropagation();
         setLookupTargetIdx(idx);
         lookupTargetIdxRef.current = idx;
         setDropdownSelectIdx(0);
         dropdownSelectIdxRef.current = 0;
         setShowLotDropdown(true);
         notifyWarning(`No pending issue found with Challan No: "${typedChln}"`);
      }
   };

   const handleChallanPick = (job) => {
      const targetIdx = lookupTargetIdxRef.current != null ? lookupTargetIdxRef.current : lookupTargetIdx;
      if (job && targetIdx != null) {
         handleSelectLot(job, targetIdx, { focusField: `grid-item-${targetIdx}` });
         setShowLotDropdown(false);
      }
   };

   useEffect(() => {
      if (!showLotDropdown) return undefined;
      setDropdownSelectIdx(0);
      dropdownSelectIdxRef.current = 0;

      const timer = setTimeout(() => {
         dropdownRef.current?.focus();
         document.getElementById('lot-item-row-0')?.scrollIntoView({ block: 'nearest' });
      }, 50);

      const onLotDropdownKeyDown = (e) => {
         const list = associatedLotsRef.current || [];
         if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setShowLotDropdown(false);
            const targetIdx = lookupTargetIdxRef.current;
            if (targetIdx != null) {
               setTimeout(() => {
                  document.getElementById(`grid-lot-${targetIdx}`)?.focus();
               }, 50);
            }
            return;
         }

         if (list.length === 0) return;

         if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setDropdownSelectIdx((prev) => {
               const nextIdx = Math.min(prev + 1, list.length - 1);
               dropdownSelectIdxRef.current = nextIdx;
               document.getElementById(`lot-item-row-${nextIdx}`)?.scrollIntoView({ block: 'nearest' });
               return nextIdx;
            });
         } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setDropdownSelectIdx((prev) => {
               const nextIdx = Math.max(prev - 1, 0);
               dropdownSelectIdxRef.current = nextIdx;
               document.getElementById(`lot-item-row-${nextIdx}`)?.scrollIntoView({ block: 'nearest' });
               return nextIdx;
            });
         } else if (e.key === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            e.stopPropagation();
            const currIdx = dropdownSelectIdxRef.current;
            const picked = list[currIdx] || list[0];
            if (picked) {
               handleChallanPick(picked);
            }
         }
      };

      window.addEventListener('keydown', onLotDropdownKeyDown, true);
      return () => {
         clearTimeout(timer);
         window.removeEventListener('keydown', onLotDropdownKeyDown, true);
      };
   }, [showLotDropdown]);

   const handleDropdownKeyDown = (e) => {
      // Capture phase window listener handles ArrowUp, ArrowDown, Enter, Escape.
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

   const totalProcessAmt = useMemo(() => {
      if (millBalance !== null && !isNaN(millBalance)) {
         return millBalance.toFixed(2);
      }
      return computedGrossAmt.toFixed(2);
   }, [millBalance, computedGrossAmt]);

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
               gPcs: acc.gPcs + (Number(l.gPcs) || 0),
               fPcs: acc.fPcs + (Number(l.fPcs) || 0),
               greyMts: acc.greyMts + (Number(l.greyMts) || 0),
               finishMts: acc.finishMts + (Number(l.finishMts) || 0),
               greyKgs: acc.greyKgs + (Number(l.greyKgs) || 0),
               recKgs: acc.recKgs + (Number(l.recKgs) || 0),
            }),
            { gPcs: 0, fPcs: 0, greyMts: 0, finishMts: 0, greyKgs: 0, recKgs: 0 }
         ),
      [lines]
   );

   // Costing Rate = (Grey.Mts * PuRate + Job Amount) / Finish.Mts (JSM formula)
   const costingRate = useMemo(() => {
      let totalCost = 0;
      let totalFinish = 0;
      linesWithAmt.forEach(l => {
         const finish = Number(l.finishMts) || 0;
         const grey = Number(l.greyMts) || 0;
         const puRate = Number(l.puRate) || 10;
         const jobAmt = Number(l.jobAmt) || 0;
         totalCost += (grey * puRate) + jobAmt;
         totalFinish += finish;
      });
      if (totalFinish > 0 && totalCost > 0) {
         return Math.round(totalCost / totalFinish);
      }
      return 460;
   }, [linesWithAmt]);

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
      const roundOff = Number(computedRoundOff) || 0;
      return (net + roundOff - tds).toFixed(2);
   }, [computedNetAmt, computedRoundOff, tdsAmt]);

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
   };

   const focusSerialNo = () => {
      setTimeout(() => {
         const el = document.getElementById('mill-rec-serial');
         if (!el || el.disabled) return;
         el.focus();
         try { el.select(); } catch { /* ignore */ }
      }, 80);
   };

   const handleNew = () => {
      setActiveTab('Mill Receive');
      setMode('Add');
      setIsEditMode(false);
      kbRef.current.isEditMode = false;
      kbRef.current.mode = 'Add';
      setLines([blankLine()]);
      setSelectedJobPartyId('');
      setGstin('');
      setBillGpNo('');
      setRConDt('');
      setBill2A('');
      setReceiveDate(today());
      setRemark('');
      setActiveReceiptKey('');
      const nextSr = getNextSerialNo();
      setSerialNo(nextSr);
      notifySuccess(`New Receive Entry — Sr No ${nextSr}`);
      focusSerialNo();
   };

   const handleEditCurrent = () => {
      if (activeReceiptKey || billGpNo || lines.some(l => l.jobId || l.itemName)) {
         setMode('Edit');
         setIsEditMode(true);
         kbRef.current.isEditMode = true;
         kbRef.current.mode = 'Edit';
         notifySuccess(`Editing receipt #${billGpNo || serialNo}`);
         setTimeout(() => {
            const el = document.getElementById('mill-rec-date');
            el?.focus();
            try { el?.select(); } catch {}
         }, 50);
      } else {
         setActiveTab('View Mill Rec');
         notifySuccess('Select any receipt from the list below to edit');
      }
   };

   kbRef.current = {
      mode,
      isEditMode,
      showFindDialog,
      showLotDropdown,
      openFind: handleOpenFindModal,
      openLot: openLotLookup,
      navigate: navigateReceipt,
      handleNew,
      handleEdit: handleEditCurrent,
   };

   const handleLoadRecord = (record) => {
      // Load the selected record into the form
      setSelectedJobPartyId(record.partyId || '');
      setGstin(record.gstin || '');
      setBillGpNo(record.billGpNo || '');
      if (record.serialNo) setSerialNo(String(record.serialNo));
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
      if (duplicateBillInfo) {
         notifyError(new Error(`Duplicate Bill/GP No: "${billGpNo.trim()}" is already used in Receipt #${duplicateBillInfo.serialNo || ''} (${duplicateBillInfo.partyName}). Duplicate save is not allowed.`));
         return;
      }
      // Allow pure-pcs items (finishMts = 0 but fPcs > 0) and normal mts-based items
      const receivable = linesWithAmt.filter(l => l.jobId && (Number(l.finishMts) > 0 || Number(l.fPcs) > 0));
      if (receivable.length === 0) {
         notifyWarning('Add at least one line with a linked challan and received Finish.Mts or Pcs');
         return;
      }

      setSaving(true);
      let ok = 0;
      const savedJobIds = new Set();
      try {
         const totalGst = Number(computedSgstAmt) + Number(computedCgstAmt) + Number(computedIgstAmt);
         for (const line of receivable) {
            const gstShare =
               computedGrossAmt > 0 ? (line.jobAmt / computedGrossAmt) * totalGst : totalGst / receivable.length;
            const pQty = Number(line.pendingQty || 0);
            const pPcs = Number(line.pendingPcs || 0);
            const lineGreyMts = Number(line.greyMts || line.finishMts || 0);
            const lineGPcs = Number(line.gPcs || line.fPcs || 0);
            const isPartial = (pQty > 0 && lineGreyMts < pQty - 0.05) || (pPcs > 0 && lineGPcs < pPcs);
            const lineIsFinal = line.isFinal !== undefined ? (line.isFinal && !isPartial) : !isPartial;

            const payload = {
               jobId: line.jobId,
               receivedQty: Number(line.finishMts) || 0,
               receivedPcs: Number(line.fPcs) || 0,
               // Challan balance is counted in grey returned (JSM); finish goes to stock.
               receivedGreyQty: Number(line.greyMts) || 0,
               receivedGreyPcs: Number(line.gPcs) || 0,
               receivedFinalQty: Number(line.finalMts) || 0,
               receivedGreyKgs: Number(line.greyKgs) || 0,
               receivedKgs: Number(line.recKgs) || 0,
               jobUnit: line.unitPQ || 'Q',
               perKgs: Number(line.perKgs) || 0,
               receiveDesc1: line.desc1 || '',
               receiveDesc2: line.desc2 || '',
               charges: Number(line.jobAmt) || 0,
               gstAmount: Number(gstShare.toFixed(2)) || 0,
               billGpNo: billGpNo.trim(),
               workerId: selectedJobPartyId,
               billType: billType,
               receiveDate: receiveDate,
               serialNo: serialNo || getNextSerialNo(),
               srNo: ok + 1,
               isFinal: lineIsFinal,
            };

            let res;
            if (isEditMode && line.isEdit) {
               res = await updateJobReceive(payload, { skipRefetch: true });
            } else {
               res = await receiveFromMill(payload, { skipRefetch: true });
            }
            if (res?._id || res?.id || line.jobId) {
               savedJobIds.add(String(res?._id || res?.id || line.jobId));
            }
            ok += 1;
         }
         const savedBillGpNo = billGpNo.trim();
         const savedSerial = serialNo || getNextSerialNo();
         notifySuccess(isEditMode ? `Receipt #${savedBillGpNo} updated successfully!` : `Receipt #${savedBillGpNo} saved successfully!`);

         // Stay on Mill Receive form in VIEW mode showing the saved receipt
         await fetchJobs();
         fetchInventory?.().catch(() => {});

         setActiveTab('Mill Receive');
         setIsEditMode(false);
         setMode('View');
         kbRef.current.isEditMode = false;
         kbRef.current.mode = 'View';

         const freshState = useStore.getState();
         const freshJobs = freshState.jobWorkEntries || [];
         const matchedJob = freshJobs.find(j =>
            (savedJobIds.size > 0 && savedJobIds.has(String(j._id || j.id))) ||
            (savedBillGpNo && String(j.billGpNo || '').trim().toLowerCase() === savedBillGpNo.toLowerCase()) ||
            (savedSerial && String(j.serialNo || '').trim() === String(savedSerial).trim())
         ) || freshJobs.filter(j => j.status === 'Received' || j.status === 'Partial')
           .slice()
           .sort((a, b) => new Date(b.updatedAt || b.receiveDate || b.createdAt || 0) - new Date(a.updatedAt || a.receiveDate || a.createdAt || 0))[0];

         if (matchedJob) {
            handleLoadReceivedJob(matchedJob, { asView: true, jobsList: freshJobs });
         }
         focusSerialNo();
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
         className="job-book-window"
         bare
      >
         {({ WindowControls }) => (
            <div className="classic-erp-window erp-density mill-rec-sheet flex flex-col h-full min-h-0 overflow-hidden !max-h-none bg-[#d4d0c8]">
               <ErpBusyOverlay show={bootLoading} message="Loading mill receive…" />
               <ErpBusyOverlay show={!bootLoading && saving} message="Saving receive…" />

               <div className="classic-erp-header shrink-0 flex justify-between items-center bg-[#858178] px-2 py-1 text-white border-b border-[#5e5a52]">
                  <span className="erp-window-title truncate font-bold text-xs flex items-center gap-1.5">
                     Mill Receipt [ {selectedBook || 'PROCESS CHARGE'} ]
                     {mode === 'View' && (
                        <span className="bg-sky-200 text-sky-950 px-1.5 py-0.5 rounded text-[9px] font-extrabold border border-sky-600">
                           RECENT RECEIPT (VIEW) · Press Enter for New Entry
                        </span>
                     )}
                     {mode === 'Edit' && (
                        <span className="bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded text-[9px] font-extrabold border border-amber-600 animate-pulse">
                           EDITING #{billGpNo || 'RECEIPT'}
                        </span>
                     )}
                     {mode === 'Add' && (
                        <span className="bg-emerald-300 text-emerald-950 px-1.5 py-0.5 rounded text-[9px] font-extrabold border border-emerald-600">
                           NEW RECEIPT #{serialNo || ''}
                        </span>
                     )}
                  </span>
                  <WindowControls />
               </div>

                <div className="flex-1 flex flex-col justify-start overflow-hidden bg-[#d4d0c8]">
                   {activeTab === 'Mill Receive' ? (
                      <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
                         
                         {/* SCROLLABLE FORM CONTENT */}
                         <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">

                         {/* Header — exact WinForms JSM Mill Receipt layout */}
                         <div className="mill-rec-head">
                            <span className="mill-rec-lab" style={{ gridArea: 'plab' }}>Job Party</span>
                            <div style={{ gridArea: 'party' }} className="flex items-center gap-1 min-w-0">
                               <ERPSelect
                                  id="mill-rec-party"
                                  className="classic-erp-select mill-rec-in flex-1 min-w-0 bg-white"
                                  data-enter-order="3"
                                  value={selectedJobPartyId}
                                  onChange={(e) => {
                                     const id = e.target.value;
                                     setSelectedJobPartyId(id);
                                     const party = (parties || []).find((p) => String(p._id || p.id) === String(id));
                                     setGstin(party?.gstin || '');
                                     setLines([blankLine()]);
                                  }}
                                  options={jobPartyOptions}
                                  placeholder=""
                                  recentKey="mill-receive-party"
                                  onCreateNew={(q) => openNewParty(q)}
                                  createLabel="Party"
                               />
                            </div>
                            <span className="mill-rec-lab" style={{ gridArea: 'gstlab' }}>GSTIN:-</span>
                            <input style={{ gridArea: 'gstin' }} type="text" className="classic-erp-input mill-rec-in bg-white font-mono" value={gstin} readOnly tabIndex={-1} />
                            
                            <span className="mill-rec-lab text-right" style={{ gridArea: 'totlab' }}>Total Process Amt(Party)</span>
                            <input style={{ gridArea: 'tot' }} type="text" className="classic-erp-input mill-rec-in text-center bg-white font-bold" value={totalProcessAmt} readOnly tabIndex={-1} />
                            
                            <span className="mill-rec-lab" style={{ gridArea: 'serlab' }}>Serial No</span>
                            <input
                               id="mill-rec-serial"
                               data-autofocus="true"
                               data-enter-order="1"
                               data-enter-nav="off"
                               style={{ gridArea: 'serial' }}
                               type="text"
                               className="classic-erp-input mill-rec-in text-center bg-white font-bold"
                               value={serialNo || '1'}
                               onChange={(e) => setSerialNo(e.target.value)}
                               title={mode === 'View' ? "Press Enter for New Entry · Press + / - to browse receipts" : "Sr No — Enter goes to Date · + / - browse receipts"}
                               onKeyDown={(e) => {
                                  const isMinus = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus' || e.key === 'PageUp';
                                  const isPlus = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal' || e.key === 'PageDown';
                                  if ((isMinus || isPlus) && !e.ctrlKey && !e.altKey) {
                                     e.preventDefault();
                                     e.stopPropagation();
                                     navigateReceipt(isMinus ? -1 : 1);
                                     return;
                                  }
                                  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (mode === 'View') {
                                     handleNew();
                                     setTimeout(() => {
                                        const d = document.getElementById('mill-rec-date');
                                        d?.focus();
                                        try { d?.select(); } catch {}
                                     }, 60);
                                     return;
                                  }
                                  const next = document.getElementById('mill-rec-date');
                                  next?.focus();
                               }}
                            />

                            <div className="mill-rec-addr font-mono" style={{ gridArea: 'addr' }}>{partyAddress || ','}</div>
                            <span className="mill-rec-lab" style={{ gridArea: 'datelab' }}>Date</span>
                            <input
                               id="mill-rec-date"
                               data-enter-order="2"
                               data-enter-nav="off"
                               style={{ gridArea: 'date' }}
                               type="date"
                               className="classic-erp-input mill-rec-in bg-white font-mono"
                               value={receiveDate}
                               onChange={(e) => setReceiveDate(e.target.value)}
                               onKeyDown={(e) => {
                                  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  document.getElementById('mill-rec-party')?.focus();
                               }}
                            />

                            <span className="mill-rec-lab" style={{ gridArea: 'revlab' }}>Reverse Charge</span>
                            <select
                               data-enter-order="6"
                               style={{ gridArea: 'rev' }}
                               className="classic-erp-select mill-rec-in bg-white"
                               value={reverseCharge}
                               onChange={(e) => setReverseCharge(e.target.value)}
                            >
                               <option value="No">No</option>
                               <option value="Yes">Yes</option>
                            </select>

                            <span className="mill-rec-lab" style={{ gridArea: 'blab' }}>Bill/Gp No</span>
                            <div style={{ gridArea: 'bill', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, position: 'relative' }}>
                               <input
                                  id="mill-rec-billgp"
                                  data-enter-order="5"
                                  type="text"
                                  className={`classic-erp-input mill-rec-in flex-1 min-w-0 ${duplicateBillInfo ? '!bg-red-50 !border-red-600 !text-red-900 font-bold ring-1 ring-red-500' : 'bg-white'}`}
                                  value={billGpNo}
                                  onChange={(e) => setBillGpNo(e.target.value)}
                                  onBlur={() => {
                                     if (duplicateBillInfo) {
                                        notifyWarning(`DUPLICATE: Bill/GP No "${billGpNo.trim()}" is already used in Receipt #${duplicateBillInfo.serialNo || ''} (${duplicateBillInfo.partyName}). Duplicate save is not allowed.`);
                                     }
                                  }}
                                  onKeyDown={(e) => {
                                     if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                                        if (duplicateBillInfo) {
                                           notifyWarning(`DUPLICATE: Bill/GP No "${billGpNo.trim()}" is already used in Receipt #${duplicateBillInfo.serialNo || ''}. Duplicate save is not allowed.`);
                                        }
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openLotLookup(lines.length - 1 >= 0 ? lines.length - 1 : 0);
                                     }
                                  }}
                               />
                               {duplicateBillInfo && (
                                  <span
                                     className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded shadow animate-pulse shrink-0 whitespace-nowrap cursor-help"
                                     title={`Duplicate Bill/GP No! Already saved in Receipt #${duplicateBillInfo.serialNo || ''} on ${duplicateBillInfo.date}`}
                                  >
                                     DUPLICATE
                                  </span>
                               )}
                            </div>

                            <span
                               style={{ gridArea: 'altllab' }}
                               onClick={() => openLotLookup(lines.length - 1 >= 0 ? lines.length - 1 : 0)}
                               className="mill-rec-altl-label"
                               title="Press Alt+L or Click to open Lot No lookup"
                            >
                               Press (ALT+L) To LotNo Entry
                            </span>
                            <input
                               style={{ gridArea: 'altlin' }}
                               type="text"
                               className="classic-erp-input mill-rec-in bg-white cursor-pointer font-bold"
                               onClick={() => openLotLookup(lines.length - 1 >= 0 ? lines.length - 1 : 0)}
                               placeholder=""
                               readOnly
                               onKeyDown={(e) => {
                                  if (e.key === 'Enter' || (e.altKey && (e.key === 'l' || e.key === 'L'))) {
                                     e.preventDefault();
                                     openLotLookup(lines.length - 1 >= 0 ? lines.length - 1 : 0);
                                  }
                               }}
                            />

                            <span className="mill-rec-lab" style={{ gridArea: 'hsnlab' }}>HSN CD</span>
                            <input
                               data-enter-order="8"
                               style={{ gridArea: 'hsn' }}
                               type="text"
                               className="classic-erp-input mill-rec-in bg-white"
                               value={hsnCd}
                               onChange={(e) => setHsnCd(e.target.value)}
                            />

                            <span className="mill-rec-lab" style={{ gridArea: 'typelab' }}>TYPE</span>
                            <select
                               data-enter-order="9"
                               style={{ gridArea: 'type' }}
                               className="classic-erp-select mill-rec-in bg-white w-full"
                               value={billType}
                               onChange={(e) => setBillType(e.target.value)}
                            >
                               <option value="BILL OF SUPPLY (OUT OF STATE)">BILL OF SUPPLY (OUT OF STATE)</option>
                               <option value="TAX INVOICE (IN STATE)">TAX INVOICE (IN STATE)</option>
                               <option value="TAX INVOICE (OUT OF STATE)">TAX INVOICE (OUT OF STATE)</option>
                               <option value="BILL OF SUPPLY (IN STATE)">BILL OF SUPPLY (IN STATE)</option>
                               <option value="Process">Process</option>
                               <option value="Other">Other</option>
                            </select>
                         </div>

                        {/* 2. TRANSACTION GRID TABLE (multi-row — one line per challan) */}
                        <div className="mill-receive-scroll border border-[#808080] bg-white min-h-[120px] max-h-[190px] overflow-auto">
                           <table className="mill-receive-grid w-full text-[10px] font-mono border-collapse" data-line-grid>
                              <thead>
                                 <tr className="bg-[#e2e8f0] text-slate-900 border-b border-[#808080] text-[10px]">
                                    <th className="border-r border-[#808080] p-1 w-8 text-center">SrNo</th>
                                    <th className="border-r border-[#808080] p-1 text-left w-16">LotNo</th>
                                    <th className="border-r border-[#808080] p-1 text-left w-16">Chln No</th>
                                    <th className="border-r border-[#808080] p-1 text-left min-w-[120px]">ItemName</th>
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-right w-12">PerKgs</th>}
                                    <th className="border-r border-[#808080] p-1 text-right w-12">G.Pcs</th>
                                    <th className="border-r border-[#808080] p-1 text-right w-16">Grey.Mts</th>
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-right w-16">Gry.Kgs</th>}
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-right w-16">Rec.Kgs</th>}
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-right w-14">Shtg.Kgs.</th>}
                                    <th className="border-r border-[#808080] p-1 text-right w-16">Finish.Mts</th>
                                    <th className="border-r border-[#808080] p-1 text-right w-16">Final.Mts</th>
                                    <th className="border-r border-[#808080] p-1 text-right w-12">Shtg%</th>
                                    <th className="border-r border-[#808080] p-1 text-right w-14">Job.Rate</th>
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-center w-12" title="Job amount on: Q Finish Mts, P Pcs, K Rec Kgs, G Grey Kgs, F Final Mts">P/Q/K</th>}
                                    <th className="border-r border-[#808080] p-1 text-right w-20">Job Amount</th>
                                    <th className="border-r border-[#808080] p-1 text-center w-8">CP</th>
                                    <th className="border-r border-[#808080] p-1 text-center w-8">Tp</th>
                                    <th className="border-r border-[#808080] p-1 text-left min-w-[100px]">Finish Item</th>
                                    <th className="border-r border-[#808080] p-1 text-center w-12">Cut</th>
                                    <th className="border-r border-[#808080] p-1 text-right w-12">F.Pcs</th>
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-left w-16">ProcType</th>}
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-left w-20">Cutting Pending</th>}
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-left w-20">Description1</th>}
                                    {showKgsCols && <th className="border-r border-[#808080] p-1 text-left w-20">Description2</th>}
                                    <th className="p-0.5 w-6 text-center" title="Delete"></th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {linesWithAmt.map((line, idx) => (
                                    <tr
                                       key={line.id}
                                       className={`border-b border-slate-200 hover:bg-slate-50 ${selectedRowIdx === idx ? 'bg-blue-50/60' : ''}`}
                                       onClick={() => setSelectedRowIdx(idx)}
                                       onKeyDown={(e) => {
                                          const isPlainDelete = e.key === 'Delete' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
                                          const isShortcutDelete =
                                             (e.shiftKey && e.key === 'Delete') ||
                                             (e.ctrlKey && e.key === 'Delete') ||
                                             (e.altKey && (e.key === 'd' || e.key === 'D'));

                                          if (isShortcutDelete) {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             removeLine(idx);
                                             return;
                                          }

                                          if (isPlainDelete) {
                                             const el = e.target;
                                             const isInputOrTextarea = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
                                             if (!isInputOrTextarea || !el.value?.trim()) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                removeLine(idx);
                                             }
                                          }
                                       }}
                                    >
                                       <td className="border-r border-slate-300 p-0.5 relative text-center font-bold">
                                          <div className="flex items-center justify-between px-0.5">
                                             <span className="text-[9px] text-slate-700">{selectedRowIdx === idx ? '▶' : ''}</span>
                                             <span>{idx + 1}</span>
                                          </div>
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-lot-${idx}`}
                                             type="text"
                                             data-enter-include=""
                                             data-enter-nav="off"
                                             className="w-full h-6 px-1 border border-transparent hover:border-slate-300 focus:border-blue-500 bg-transparent text-slate-900 font-mono cursor-pointer font-bold"
                                             value={line.lotNo}
                                             readOnly
                                             placeholder="Press Enter..."
                                             title="Enter opens Select Challan. Click or Alt+L also opens it"
                                             onClick={() => openLotLookup(idx)}
                                             onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                                                   e.preventDefault();
                                                   e.stopPropagation();
                                                   openLotLookup(idx);
                                                }
                                             }}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-chln-${idx}`}
                                             type="text"
                                             className="w-full h-6 px-1 border-none bg-transparent"
                                             value={line.chlnNo}
                                             placeholder="Chln…"
                                             onChange={(e) => setLineField(idx, 'chlnNo', e.target.value)}
                                             onKeyDown={(e) => handleChallanKeyDown(e, idx)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-item-${idx}`}
                                             type="text"
                                             className="w-full h-6 px-1 border-none bg-transparent uppercase font-semibold"
                                             value={line.itemName}
                                             onChange={(e) => setLineField(idx, 'itemName', e.target.value)}
                                          />
                                       </td>
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="number"
                                                className="w-full h-6 px-1 border-none text-right bg-transparent"
                                                value={line.perKgs}
                                                onChange={(e) => setLineField(idx, 'perKgs', e.target.value)}
                                             />
                                          </td>
                                       )}
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent font-medium"
                                             value={line.gPcs}
                                             onChange={(e) => setLineField(idx, 'gPcs', e.target.value)}
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent font-medium"
                                             value={line.greyMts}
                                             onChange={(e) => setLineField(idx, 'greyMts', e.target.value)}
                                          />
                                       </td>
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="number"
                                                className="w-full h-6 px-1 border-none text-right bg-transparent"
                                                value={line.greyKgs}
                                                onChange={(e) => setLineField(idx, 'greyKgs', e.target.value)}
                                             />
                                          </td>
                                       )}
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="number"
                                                className="w-full h-6 px-1 border-none text-right bg-transparent"
                                                value={line.recKgs}
                                                onChange={(e) => setLineField(idx, 'recKgs', e.target.value)}
                                             />
                                          </td>
                                       )}
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="text"
                                                data-enter-include=""
                                                className="w-full h-6 px-1 border-none text-right bg-slate-100"
                                                value={lineShtgKgs(line)}
                                                readOnly
                                             />
                                          </td>
                                       )}
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-finish-mts-${idx}`}
                                             type="number"
                                             className="w-full h-6 px-1 border-none text-right bg-transparent font-medium"
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
                                             data-enter-include=""
                                             className="w-full h-6 px-1 border-none text-right bg-slate-100"
                                             value={lineShortagePct(line)}
                                             readOnly
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
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <select
                                                className="w-full h-6 px-0.5 border-none bg-transparent text-[10px] font-bold text-center"
                                                value={line.unitPQ || 'Q'}
                                                onChange={(e) => setLineField(idx, 'unitPQ', e.target.value)}
                                                title="Job amount on: Q Finish Mts, P Pcs, K Rec Kgs, G Grey Kgs, F Final Mts"
                                             >
                                                {UNIT_PQ.map(([v, label]) => <option key={v} value={v} title={label}>{v}</option>)}
                                             </select>
                                          </td>
                                       )}
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             type="text"
                                             data-enter-include=""
                                             className="w-full h-6 px-1 border-none text-right bg-slate-100 font-bold"
                                             value={line.jobAmt}
                                             readOnly
                                          />
                                       </td>
                                       <td className="border-r border-slate-300 p-0.5">
                                          <input
                                             id={`grid-cp-${idx}`}
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
                                       {showKgsCols && (
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
                                       )}
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="text"
                                                className="w-full h-6 px-1 border-none bg-transparent"
                                                value={line.cuttingPending}
                                                onChange={(e) => setLineField(idx, 'cuttingPending', e.target.value)}
                                             />
                                          </td>
                                       )}
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="text"
                                                className="w-full h-6 px-1 border-none bg-transparent"
                                                value={line.desc1}
                                                onChange={(e) => setLineField(idx, 'desc1', e.target.value)}
                                             />
                                          </td>
                                       )}
                                       {showKgsCols && (
                                          <td className="border-r border-slate-300 p-0.5">
                                             <input
                                                type="text"
                                                className="w-full h-6 px-1 border-none bg-transparent"
                                                value={line.desc2}
                                                onChange={(e) => setLineField(idx, 'desc2', e.target.value)}
                                             />
                                          </td>
                                       )}
                                       <td className="p-0.5 text-center">
                                          <button
                                             type="button"
                                             className="text-red-600 hover:text-red-800 disabled:opacity-30"
                                             data-delete-line
                                             onClick={() => removeLine(idx)}
                                             title="Delete this line (Delete key)"
                                          >
                                             <Trash2 size={11} />
                                          </button>
                                       </td>
                                    </tr>
                                 ))}
                                 {/* Star blank row (classic WinForms DataGridView new row) */}
                                 <tr className="border-b border-slate-200 bg-white opacity-70 hover:opacity-100 cursor-pointer" onClick={addLine}>
                                    <td className="border-r border-slate-300 p-0.5 text-center font-bold text-slate-700">*</td>
                                    <td colSpan={showKgsCols ? 25 : 16} className="p-0.5 text-[9px] text-slate-400 italic">
                                       Click or press Enter on last field to add new line
                                    </td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>

                        {/* Minimal toolbar toggle for Kgs columns if user wants them */}
                        <div className="flex justify-between items-center text-[10px] px-1">
                           <button
                              type="button"
                              className="text-slate-600 hover:text-slate-900 underline font-semibold cursor-pointer"
                              onClick={() => setShowKgsCols(!showKgsCols)}
                           >
                              {showKgsCols ? '← Switch to Standard View (Hide Kgs Columns)' : '+ Show Kgs & Extra Columns'}
                           </button>
                        </div>

                        {/* 3. SUMMARY BAR (Exact JSM Cyan Bar with CostingRate Badge) */}
                        <div className="bg-[#00e5d3] text-slate-900 text-[11px] font-bold px-2 py-1 flex justify-between items-center uppercase border border-[#00c4b4] tracking-tight">
                           <div className="bg-black text-white px-2 py-0.5 text-[11px] font-bold tracking-wider">
                              CostingRate : {costingRate}
                           </div>
                           <div className="tracking-tight font-extrabold text-[11px] text-slate-900">
                              TOTAL PCS : {gridTotals.gPcs || gridTotals.fPcs} &nbsp; / &nbsp; Send.Mts : {Number(gridTotals.greyMts).toFixed(0)} Rec.Mts : {Number(gridTotals.finishMts).toFixed(0)} FnsPcs: {Number(gridTotals.fPcs).toFixed(0)} / (Snd.Kgs : {Number(gridTotals.greyKgs).toFixed(0)} Rec.Kgs : {Number(gridTotals.recKgs).toFixed(0)})
                           </div>
                        </div>

                        {/* 4. FOOTER MULTI-COLUMN ADJUSTMENTS */}
                        <div className="mill-rec-foot grid grid-cols-12 gap-1 text-[11px] p-1.5 border border-[#808080] bg-[#d4d0c8]" data-enter-footer>

                           {/* Column 1: Adjustments */}
                           <div className="col-span-3 space-y-1.5 border-r border-[#a0a0a0] pr-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">Less</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={lessPercent}
                                    onChange={(e) => handleLessPercentChange(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-bold"
                                    value={lessAmt}
                                    onChange={(e) => setLessAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">Other Less</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={otherLessPercent}
                                    onChange={(e) => handleOtherLessPercentChange(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-bold"
                                    value={otherLessAmt}
                                    onChange={(e) => setOtherLessAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">Other Add</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={otherAddPercent}
                                    onChange={(e) => handleOtherAddPercentChange(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-bold"
                                    value={otherAddAmt}
                                    onChange={(e) => setOtherAddAmt(e.target.value)}
                                 />
                              </div>
                           </div>

                           {/* Column 2: TDS Details & Due Days */}
                           <div className="col-span-3 space-y-1.5 border-r border-[#a0a0a0] px-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-800 font-semibold text-right">On Tds Amount</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-bold"
                                    value={onTdsAmt}
                                    onChange={(e) => setOnTdsAmt(e.target.value)}
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-800 font-semibold text-right">T.d.s.</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input w-14 text-center bg-white font-mono"
                                    value={tdsPercent}
                                    placeholder="0.0000"
                                    onChange={(e) => setTdsPercent(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white font-bold"
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
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-800 font-semibold text-right" title="Credit / Due Days (_txt_ddays)">Due Days</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-10 text-center bg-white font-bold"
                                    value={dueDays}
                                    onChange={(e) => {
                                       const d = parseInt(e.target.value, 10);
                                       setDueDays(e.target.value);
                                       if (!isNaN(d) && d > 0) {
                                          const dt = new Date(receiveDate || new Date());
                                          dt.setDate(dt.getDate() + d);
                                          setDueDate(dt.toISOString().substring(0, 10));
                                       }
                                    }}
                                    placeholder="0"
                                 />
                                 <input
                                    type="date"
                                    className="classic-erp-input flex-1 text-center bg-white text-[10px]"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    title="Payment Due Date (_txt_ddate)"
                                 />
                              </div>
                           </div>

                           {/* Column 3: GST Details (Warm Cream Beige GroupBox) */}
                           <div className="mill-rec-gstbox col-span-3 space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-bold px-1">
                                 <span className="text-slate-800">TaxableAmt</span>
                                 <span className="font-mono text-slate-900 font-extrabold pr-1">{Number(effectiveGstBase).toFixed(0)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">SGST %</span>
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
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-white font-mono font-bold"
                                    value={computedSgstAmt}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">CGST %</span>
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
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-white font-mono font-bold"
                                    value={computedCgstAmt}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">IGST %</span>
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
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-white font-mono font-bold"
                                    value={computedIgstAmt}
                                    disabled
                                 />
                              </div>
                           </div>

                           {/* Column 4: Totals Block */}
                           <div className="col-span-3 space-y-1 pl-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Gross Amt</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold"
                                    value={computedGrossAmt.toFixed(2)}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Round Off</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold"
                                    value={computedRoundOff}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-800 font-semibold text-right text-amber-900">RCM GST</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right font-bold mill-rec-rcm border border-amber-400"
                                    value={rcmGst}
                                    onChange={(e) => setRcmGst(e.target.value)}
                                    disabled={reverseCharge !== 'Yes'}
                                 />
                              </div>
                              <div className="flex items-center gap-1 border-t border-slate-300 pt-0.5">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Net Amount</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold text-blue-900"
                                    value={computedNetAmt.toFixed(2)}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-24 text-slate-700 font-semibold text-right">Final Amount</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input flex-1 text-right bg-slate-100 font-bold text-red-900"
                                    value={computedFinalAmt}
                                    disabled
                                 />
                              </div>
                           </div>

                           {/* Spanning Remark across left bottom */}
                           <div className="col-span-6 flex items-center gap-1 pt-1 border-t border-[#a0a0a0]">
                              <span className="w-16 text-slate-800 font-semibold text-right">Remark</span>
                              <input
                                 type="text"
                                 className="classic-erp-input flex-1 bg-white"
                                 value={remark}
                                 onChange={(e) => setRemark(e.target.value)}
                              />
                           </div>

                        </div>

                        {/* Status Label centered under totals */}
                        <div className="text-blue-700 font-bold text-center text-[12px] py-0.5 tracking-wide">
                           {mode === 'View' ? (lines[0]?.isFinal ? 'Closed' : 'Pending') : 'Pending'}
                        </div>

                        </div>

                        {/* 5. ACTION BUTTONS FOOTER BAR (PINNED AT BOTTOM) */}
                         <div className="mill-rec-actions shrink-0 z-10">
                            <div className="mill-rec-action-row">
                               <button
                                  type="button"
                                  onClick={handleNew}
                                  className="mill-rec-btn mill-rec-btn-new"
                                  title="New (Alt+N)"
                               >
                                  New
                               </button>
                               <button
                                  type="button"
                                  onClick={handleEditCurrent}
                                  className={`mill-rec-btn ${mode === 'Edit' ? 'bg-amber-300 font-bold' : ''}`}
                                  title="Edit current receipt (Alt+E / F2)"
                               >
                                  Edit
                               </button>
                               <button
                                  type="button"
                                  onClick={handleSubmit}
                                  disabled={saving || !selectedJobPartyId}
                                  data-enter-save="true"
                                  className="mill-rec-btn"
                               >
                                  <SaveButtonLabel saving={saving} idle={mode === 'Edit' ? 'Update' : 'Save'} busy={mode === 'Edit' ? 'Updating…' : 'Saving…'} />
                               </button>
                               <button type="button" onClick={onClose} className="mill-rec-btn">Cancel</button>
                               <button type="button" onClick={handleOpenFindModal} className="mill-rec-btn" title="Find (F3)">Find</button>
                               <button type="button" onClick={handleOpenFindModal} className="mill-rec-btn">Sp.FInd</button>
                               <button type="button" onClick={() => notifyWarning('Select a record to delete')} className="mill-rec-btn">Delete</button>
                               <button type="button" onClick={onClose} className="mill-rec-btn">Exit</button>
                               <span className="flex-1" />
                               <button
                                  type="button"
                                  className="mill-rec-btn min-w-[75px]"
                                  onClick={() => {
                                     setLines(prev => prev.map(l => ({ ...l, isFinal: true })));
                                     notifySuccess('Bill marked as Closed / Final');
                                  }}
                                  title="Close this bill"
                               >
                                  Close Bill
                               </button>
                               <span className="flex-1" />
                               <button
                                  type="button"
                                  className="mill-rec-btn !text-red-600 font-bold"
                                  onClick={() => {
                                     if (onOpenPayment) onOpenPayment(selectedJobPartyId);
                                     else notifyWarning('Open Transaction > Bank Payment / Cash Payment to make payment');
                                  }}
                               >
                                  Payment Entry
                               </button>
                               <button type="button" onClick={handlePrint} className="mill-rec-btn">Print</button>
                            </div>
                            <div className="mill-rec-nav-row">
                               <div className="mill-rec-status font-bold uppercase truncate" title={selectedParty?.name || 'Party'}>
                                  {selectedParty?.name || (mode === 'View' ? (sortedReceivedJobs[0]?.workerId?.name || 'FASK SUPPLIER') : `New Entry #${serialNo}`)}
                               </div>
                               <button type="button" className="mill-rec-btn" onClick={() => navigateReceipt('first')} title="First Receipt">First</button>
                               <button type="button" className="mill-rec-btn" onClick={() => navigateReceipt(1)} title="Next Receipt (+)">Next</button>
                               <button type="button" className="mill-rec-btn" onClick={() => navigateReceipt(-1)} title="Previous Receipt (-)">PriV</button>
                               <button type="button" className="mill-rec-btn" onClick={() => navigateReceipt('last')} title="Last Receipt">Last</button>
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
                        className="w-[780px] max-w-[95vw] bg-[#d4d0c8] border-2 border-white border-r-[#808080] border-b-[#808080] shadow-md flex flex-col font-mono text-[11px] outline-none"
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
                                       <th className="p-1 border-r border-[#808080] text-right">Issued (Mts / Pcs)</th>
                                       <th className="p-1 border-r border-[#808080] text-right">Received (Mts / Pcs)</th>
                                       <th className="p-1 text-right">Pending Balance (Mts / Pcs)</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {associatedLots.length > 0 ? (
                                       associatedLots.map((job, i) => {
                                          const pending = jobPending(job);
                                          const recQty = Number(job.receivedGreyQty ?? job.receivedQty ?? 0);
                                          const recPcs = Number(job.receivedGreyPcs ?? job.receivedPcs ?? 0);
                                          const isPartialRec = recQty > 0 || recPcs > 0;
                                          return (
                                             <tr
                                                key={job._id}
                                                id={`lot-item-row-${i}`}
                                                onClick={() => handleChallanPick(job)}
                                                onMouseEnter={() => {
                                                   setDropdownSelectIdx(i);
                                                   dropdownSelectIdxRef.current = i;
                                                }}
                                                className={`border-b border-slate-200 cursor-pointer ${i === dropdownSelectIdx ? 'bg-blue-600 text-white font-bold' : 'hover:bg-sky-100 text-slate-900'}`}
                                             >
                                                <td className={`p-1.5 border-r border-slate-200 font-bold ${i === dropdownSelectIdx ? 'text-white' : 'text-blue-900'}`}>
                                                   <div className="flex items-center gap-1">
                                                      <span>{job.challanNo || job.jobCardNo}</span>
                                                      {isPartialRec && (
                                                         <span className={`px-1 py-0.2 text-[9px] rounded font-bold uppercase ${i === dropdownSelectIdx ? 'bg-amber-300 text-amber-950' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                                                            Partial
                                                         </span>
                                                      )}
                                                   </div>
                                                </td>
                                                <td className="p-1.5 border-r border-slate-200">{job.lotId?.lotId || job.lotId || 'N/A'}</td>
                                                <td className="p-1.5 border-r border-slate-200 uppercase font-sans">{job.lotId?.itemId?.name || job.lotId?.itemName || job.itemName || 'N/A'}</td>
                                                <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                                                   <div>{Number(job.issueQty || 0).toFixed(2)} Mts</div>
                                                   <div className={`text-[10px] ${i === dropdownSelectIdx ? 'text-blue-100' : 'text-slate-500'}`}>({job.issuePcs || 0} Pcs)</div>
                                                </td>
                                                <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                                                   <div>{recQty.toFixed(2)} Mts</div>
                                                   <div className={`text-[10px] ${i === dropdownSelectIdx ? 'text-blue-100' : 'text-slate-500'}`}>({recPcs} Pcs)</div>
                                                </td>
                                                <td className={`p-1.5 text-right font-bold font-mono ${i === dropdownSelectIdx ? 'text-white' : 'text-emerald-700'}`}>
                                                   <div>{pending.qty.toFixed(2)} Mts</div>
                                                   <div className={`text-[10px] ${i === dropdownSelectIdx ? 'text-emerald-200' : 'text-emerald-600'}`}>({pending.pcs} Pcs)</div>
                                                </td>
                                             </tr>
                                          );
                                       })
                                    ) : (
                                       <tr>
                                          <td colSpan="6" className="p-4 text-center text-slate-400 italic">No associated lots found.</td>
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
                   <ErpTopLayer>
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
                   </ErpTopLayer>
                )}

               {printOpen && (
                  <JobWorkPrint variant="millReceive" data={printData} onClose={() => setPrintOpen(false)} />
               )}

               <AccountMasterModal
                  isOpen={!!accountModal}
                  onClose={() => setAccountModal(null)}
                  initialData={accountModal}
                  onSuccess={handleAccountSuccess}
               />

            </div>
         )}
      </ErpWindowedModal>
   );
};

export default ReceiveModal;
