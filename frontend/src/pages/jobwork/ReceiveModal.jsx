import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const ReceiveModal = ({ isOpen, onClose, selectedBook = null }) => {
   const {
      jobWorkEntries,
      fetchJobs,
      receiveFromMill,
      fetchInventory,
      items,
      fetchItems
   } = useStore();

   const [activeTab, setActiveTab] = useState('Mill Receive');
   const [selectedJobId, setSelectedJobId] = useState('');
   const [receivedPcs, setReceivedPcs] = useState('');
   const [receivedQty, setReceivedQty] = useState('');
   const [rate, setRate] = useState('');
   const [gstPercent, setGstPercent] = useState('5');
   const [saving, setSaving] = useState(false);
   const [bootLoading, setBootLoading] = useState(false);

   // New UI Structuring state variables (UI Only Phase)
   const [selectedJobPartyId, setSelectedJobPartyId] = useState('');
   const [jobParty, setJobParty] = useState('');
   const [gstin, setGstin] = useState('');
   const [billGpNo, setBillGpNo] = useState('');
   const [reverseCharge, setReverseCharge] = useState('No');
   const [hsnCd, setHsnCd] = useState('');
   const [billType, setBillType] = useState('Process');
   const [totalProcessAmt, setTotalProcessAmt] = useState('1164');
   const [serialNo, setSerialNo] = useState('4');
   const [receiveDate, setReceiveDate] = useState(new Date().toISOString().substring(0, 10));
   const [showLotDropdown, setShowLotDropdown] = useState(false);
   const [dropdownSelectIdx, setDropdownSelectIdx] = useState(0);
   const dropdownRef = React.useRef(null);

   // Grid fields (static single row representation for UI only)
   const [gridLotNo, setGridLotNo] = useState('');
   const [gridChlnNo, setGridChlnNo] = useState('');
   const [gridItemName, setGridItemName] = useState('');
   const [gridGPcs, setGridGPcs] = useState('0');
   const [gridGreyMts, setGridGreyMts] = useState('0.00');
   const [gridFinishMts, setGridFinishMts] = useState('0.00');
   const [gridFinalMts, setGridFinalMts] = useState('0.00');
   const [gridShtg, setGridShtg] = useState('0.0');
   const [gridJobRate, setGridJobRate] = useState('0.00');
   const [gridJobAmt, setGridJobAmt] = useState('0.00');
   const [gridCP, setGridCP] = useState('');
   const [gridTp, setGridTp] = useState('');
   const [gridFinishItem, setGridFinishItem] = useState('');
   const [gridCut, setGridCut] = useState('0');
   const [gridFPcs, setGridFPcs] = useState('0');
   const [gridProcType, setGridProcType] = useState('');
   const [gridCuttingPending, setGridCuttingPending] = useState('');

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
   const [sgstAmt, setSgstAmt] = useState('0');
   const [cgstPercent, setCgstPercent] = useState('0');
   const [cgstAmt, setCgstAmt] = useState('0');
   const [igstPercent, setIgstPercent] = useState('0');
   const [igstAmt, setIgstAmt] = useState('0');

   // Totals Block
   const [grossAmt, setGrossAmt] = useState('0');
   const [roundOff, setRoundOff] = useState('0.00');
   const [rcmGst, setRcmGst] = useState('0.00');
   const [netAmt, setNetAmt] = useState('0.00');
   const [finalAmt, setFinalAmt] = useState('0.00');

   useEffect(() => {
      if (!isOpen) {
         setBootLoading(false);
         return;
      }
      let cancelled = false;
      setBootLoading(true);
      Promise.all([fetchJobs(), fetchInventory?.(), fetchItems?.()])
         .catch(() => { })
         .finally(() => {
            if (!cancelled) setBootLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, [isOpen, fetchJobs, fetchInventory, fetchItems]);

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
      return jobWorkEntries.filter(j => j.status === 'Issued');
   }, [jobWorkEntries]);

   const jobPartyOptions = useMemo(() => {
      const uniqueParties = {};
      pendingJobs.forEach(j => {
         if (j.workerId) {
            const id = String(j.workerId._id || j.workerId.id || j.workerId);
            const name = typeof j.workerId === 'object' ? j.workerId.name : 'Worker';
            uniqueParties[id] = name;
         }
      });
      return Object.entries(uniqueParties).map(([id, name]) => ({
         value: id,
         label: name
      }));
   }, [pendingJobs]);

    const associatedLots = useMemo(() => {
       if (!selectedJobPartyId) return [];
       const list = pendingJobs.filter(j => {
          if (!j.workerId) return false;
          const workerIdStr = String(j.workerId._id || j.workerId.id || j.workerId);
          return workerIdStr === String(selectedJobPartyId);
       });
       const q = String(gridLotNo || '').trim().toLowerCase();
       if (!q) return list;
       return list.filter(j => {
          const lotVal = String(j.lotId?.lotId || j.lotId || '').toLowerCase();
          const chlnVal = String(j.jobCardNo || '').toLowerCase();
          const itemVal = String(j.lotId?.itemId?.name || j.lotId?.itemName || '').toLowerCase();
          return lotVal.includes(q) || chlnVal.includes(q) || itemVal.includes(q);
       });
    }, [pendingJobs, selectedJobPartyId, gridLotNo]);

   const gstOptions = [
      { value: '0', label: '0%' },
      { value: '5', label: '5%' },
      { value: '12', label: '12%' },
      { value: '18', label: '18%' },
   ];

   const receivedJobs = useMemo(() => {
      return jobWorkEntries.filter(j => j.status === 'Received');
   }, [jobWorkEntries]);

   const selectedJob = useMemo(() => {
      return jobWorkEntries.find(j => j._id === selectedJobId) || null;
   }, [selectedJobId, jobWorkEntries]);

    const handleSelectLot = (job, options = {}) => {
       setGridLotNo(job.lotId?.lotId || '');
       setGridChlnNo(job.challanNo || job.jobCardNo || '');
       setGridItemName(job.lotId?.itemId?.name || job.lotId?.itemName || '');
       setGridCP('C');
       setGridCuttingPending('P');
       setGridProcType('Finish');
        // Populate actuals from job issue
        setGridGPcs(String(job.issuePcs || 0));
        setGridGreyMts(Number(job.issueQty || 0).toFixed(2));
        setGridFinishMts('0.00');
        setGridFinalMts('0.00');
        setGridFPcs(String(job.issuePcs || 0));
        setGridJobRate(Number(job.jobRate || 0).toFixed(2));
 
       // Populate gstin, hsnCd, and tax defaults for the header/footer
       setGstin(job.workerId?.gstin || '');
       setHsnCd(job.hsnCd || '5407');
       const gstPct = job.gstPercent ? Number(job.gstPercent) : 5;
       setSgstPercent((gstPct / 2).toString());
       setCgstPercent((gstPct / 2).toString());
       setIgstPercent('0');
 
       // Keep legacy fields populated for backward compatibility with submit handlers
       setReceivedPcs('0');
       setReceivedQty('0');
       setRate(0);
 
       // Save selected Job Card ID for submission
       setSelectedJobId(job._id);
 
       // Focus the specified field or default to Challan No
       const focusFieldId = options.focusField || 'grid-chln-no';
       setTimeout(() => {
          const el = document.getElementById(focusFieldId);
          if (el) {
             el.focus();
             el.select?.();
          }
       }, 100);
    };

    const handleChlnNoEnter = (e) => {
       if (!selectedJobPartyId) {
          notifyWarning('Please select a Job Party first');
          return;
       }
        const typedChln = String(gridChlnNo || '').trim();
        if (!typedChln) {
           e.preventDefault();
           e.stopPropagation();
           setShowLotDropdown(true);
           return;
        }
       
       const query = typedChln.toLowerCase();
       const matches = associatedLots.filter(j => 
          String(j.jobCardNo || '').toLowerCase() === query || 
          String(j.challanNo || '').toLowerCase() === query
       );
       
       if (matches.length === 1) {
          e.preventDefault();
          e.stopPropagation();
          handleSelectLot(matches[0], { focusField: 'grid-finish-mts' });
          notifySuccess(`Loaded Challan ${matches[0].challanNo || matches[0].jobCardNo}`);
       } else if (matches.length > 1) {
          e.preventDefault();
          e.stopPropagation();
          setShowLotDropdown(true);
       } else {
          e.preventDefault();
          e.stopPropagation();
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
          if (associatedLots[dropdownSelectIdx]) {
             handleSelectLot(associatedLots[dropdownSelectIdx]);
             setShowLotDropdown(false);
          }
       } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowLotDropdown(false);
       }
    };

   // Derived Calculations
    const calculatedShortage = useMemo(() => {
       const grey = Number(gridGreyMts) || 0;
       const finish = Number(gridFinishMts) || 0;
       if (isNaN(grey) || isNaN(finish) || grey <= 0 || finish <= 0) return '0.0';
       const diff = grey - finish;
       const pct = (diff / grey) * 100;
       return isNaN(pct) ? '0.0' : pct.toFixed(1);
    }, [gridGreyMts, gridFinishMts]);

    const calculatedJobAmt = useMemo(() => {
       const finalVal = Number(gridFinalMts) || 0;
       const finish = Number(gridFinishMts) || 0;
       const rateVal = Number(gridJobRate) || 0;
       const qty = finalVal > 0 ? finalVal : finish;
       return (qty * rateVal).toFixed(2);
    }, [gridFinishMts, gridFinalMts, gridJobRate]);
 
    const computedGrossAmt = useMemo(() => {
       return Number(calculatedJobAmt) || 0;
    }, [calculatedJobAmt]);

    const finishItemOptions = useMemo(() => {
       return (items || []).map((item) => ({
          value: item.name || item.itemName || '',
          label: item.name || item.itemName || '',
       })).sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);
 
    // Synchronize TDS base amount to Gross Amt automatically
    useEffect(() => {
       setOnTdsAmt(computedGrossAmt.toFixed(2));
    }, [computedGrossAmt]);
 
    // Synchronize TDS Amt state from base/percent
    useEffect(() => {
       const base = Number(onTdsAmt) || computedGrossAmt;
       const pct = Number(tdsPercent) || 0;
       setTdsAmt(((base * pct) / 100).toFixed(2));
    }, [onTdsAmt, computedGrossAmt, tdsPercent]);

    // Handlers for Cut/FPcs change relations
    const handleCutChange = (val) => {
       setGridCut(val);
       const cutVal = Number(val) || 0;
       const finish = Number(gridFinishMts) || 0;
       if (cutVal > 0 && finish > 0) {
          setGridFPcs(String(Math.round(finish / cutVal)));
       }
    };

    const handleFPcsChange = (val) => {
       setGridFPcs(val);
       const pcsVal = Number(val) || 0;
       const finish = Number(gridFinishMts) || 0;
       if (pcsVal > 0 && finish > 0) {
          setGridCut((finish / pcsVal).toFixed(2));
       }
    };

    // Sync pieces when Finish.Mts changes
    useEffect(() => {
       const finish = Number(gridFinishMts) || 0;
       const cutVal = Number(gridCut) || 0;
       if (cutVal > 0 && finish > 0) {
          setGridFPcs(String(Math.round(finish / cutVal)));
       }
    }, [gridFinishMts]);

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
       setLessAmt(((gross * pct1) / 100).toFixed(2));

       const pct2 = Number(otherLessPercent) || 0;
       setOtherLessAmt(((gross * pct2) / 100).toFixed(2));

       const pct3 = Number(otherAddPercent) || 0;
       setOtherAddAmt(((gross * pct3) / 100).toFixed(2));
    }, [computedGrossAmt]);
 
    const computedSgstAmt = useMemo(() => {
       const pct = Number(sgstPercent) || 0;
       return ((computedGrossAmt * pct) / 100).toFixed(2);
    }, [computedGrossAmt, sgstPercent]);
 
    const computedCgstAmt = useMemo(() => {
       const pct = Number(cgstPercent) || 0;
       return ((computedGrossAmt * pct) / 100).toFixed(2);
    }, [computedGrossAmt, cgstPercent]);
 
    const computedIgstAmt = useMemo(() => {
       const pct = Number(igstPercent) || 0;
       return ((computedGrossAmt * pct) / 100).toFixed(2);
    }, [computedGrossAmt, igstPercent]);
 
    const computedNetAmt = useMemo(() => {
       const gross = computedGrossAmt;
       const sgst = Number(computedSgstAmt) || 0;
       const cgst = Number(computedCgstAmt) || 0;
       const igst = Number(computedIgstAmt) || 0;
 
       const lessVal = Number(lessAmt) || 0;
       const otherLess = Number(otherLessAmt) || 0;
       const otherAdd = Number(otherAddAmt) || 0;
 
       return gross + sgst + cgst + igst - lessVal - otherLess + otherAdd;
    }, [computedGrossAmt, computedSgstAmt, computedCgstAmt, computedIgstAmt, lessAmt, otherLessAmt, otherAddAmt]);
 
    const computedRoundOff = useMemo(() => {
       const net = computedNetAmt;
       const rounded = Math.round(net);
       return (rounded - net).toFixed(2);
    }, [computedNetAmt]);
 
    const computedFinalAmt = useMemo(() => {
       const net = computedNetAmt;
       const tds = Number(tdsAmt) || 0;
       return Math.round(net - tds);
    }, [computedNetAmt, tdsAmt]);

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!selectedJobId) {
         notifyWarning('Please select a pending process job card');
         return;
      }
      if (!billGpNo || String(billGpNo).trim() === '') {
         notifyWarning('Please enter Bill/GP No.');
         return;
      }
      const receivedQtyVal = Number(gridFinishMts) || 0;
      if (receivedQtyVal <= 0) {
         notifyWarning('Please enter a valid received quantity (Finish.Mts)');
         return;
      }

      setSaving(true);
      try {
         const totalGst = Number(computedSgstAmt) + Number(computedCgstAmt) + Number(computedIgstAmt);
         await receiveFromMill({
            jobId: selectedJobId,
            receivedQty: receivedQtyVal,
            receivedPcs: Number(gridFPcs) || 0,
            wastage: Math.max(0, Number(gridGreyMts) - receivedQtyVal),
            charges: computedGrossAmt,
            gstAmount: totalGst,
            billGpNo: billGpNo.trim()
         });
         notifySuccess('Challan received and finished lots added to stock!');
         setSelectedJobId('');
         setBillGpNo('');
         setGridLotNo('');
         setGridChlnNo('');
         setGridItemName('');
         setGridGPcs('0');
         setGridGreyMts('0.00');
         setGridFinishMts('0.00');
         setGridFinalMts('0.00');
         setGridFPcs('0');
         setGridJobRate('0.00');
         setActiveTab('View Mill Rec');
         await fetchJobs();
         await fetchInventory();
      } catch (err) {
         notifyError(err, 'Failed to receive job');
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
                  <span className="erp-window-title truncate font-bold text-xs">Mill Receipt [ {selectedBook || 'PROCESS CHARGE'} ]</span>
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

               <div className="flex-1 flex flex-col justify-start overflow-hidden bg-[#d4d0c8] p-2">
                  {activeTab === 'Mill Receive' ? (
                     <div className="w-full flex flex-col overflow-y-auto no-scrollbar gap-2 pb-2">

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
                                       setSelectedJobId(''); // Reset selected job card
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
                              <div className="col-span-1.5 flex items-center gap-1">
                                 <span className="text-slate-800 font-semibold">Serial No:</span>
                                 <input
                                    type="text"
                                    className="classic-erp-input w-12 text-center bg-slate-100 font-bold"
                                    value={serialNo}
                                    disabled
                                 />
                              </div>
                              <div className="col-span-1.5 flex items-center gap-1">
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
                                 <span className="text-red-700 font-bold italic text-[9px]">Press (ALT+L) To LotNo Entry</span>
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

                        {/* 2. TRANSACTION GRID TABLE */}
                        <div className="border border-[#808080] bg-white overflow-x-auto min-h-[180px] max-h-[220px]">
                           <table className="min-w-[1400px] w-full text-[10px] font-mono border-collapse">
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
                                    <th className="p-1 w-28 text-left">Cutting Pending</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {/* Interactive structured inputs for UI only */}
                                 <tr className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="border-r border-slate-300 p-1 text-center bg-slate-100 font-bold">1</td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="text"
                                          className="w-full h-6 px-1 border-none bg-slate-100 text-slate-500 font-mono"
                                          value={gridLotNo}
                                          readOnly
                                          disabled
                                          placeholder="Auto-filled"
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          id="grid-chln-no"
                                          type="text"
                                          className="w-full h-6 px-1 border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-sky-100 font-mono cursor-pointer"
                                          value={gridChlnNo}
                                          onChange={(e) => setGridChlnNo(e.target.value)}
                                          onClick={() => {
                                             if (!selectedJobPartyId) {
                                                notifyWarning('Please select a Job Party first');
                                                return;
                                             }
                                             setShowLotDropdown(true);
                                          }}
                                          onKeyDown={(e) => {
                                             if (e.key === 'Enter') {
                                                if (!gridChlnNo || !selectedJobId) {
                                                   e.preventDefault();
                                                   e.stopPropagation();
                                                   if (!selectedJobPartyId) {
                                                      notifyWarning('Please select a Job Party first');
                                                      return;
                                                   }
                                                   setShowLotDropdown(true);
                                                } else {
                                                   handleChlnNoEnter(e);
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
                                          value={gridItemName}
                                          onChange={(e) => setGridItemName(e.target.value)}
                                          disabled
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          id="grid-g-pcs"
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-transparent"
                                          value={gridGPcs}
                                          onChange={(e) => setGridGPcs(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          id="grid-grey-mts"
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-transparent"
                                          value={gridGreyMts}
                                          onChange={(e) => setGridGreyMts(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          id="grid-finish-mts"
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-transparent"
                                          value={gridFinishMts}
                                          onChange={(e) => setGridFinishMts(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-transparent"
                                          value={gridFinalMts}
                                          onChange={(e) => setGridFinalMts(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="text"
                                          className="w-full h-6 px-1 border-none text-right bg-slate-100"
                                          value={calculatedShortage}
                                          disabled
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-transparent font-bold"
                                          value={gridJobRate}
                                          onChange={(e) => setGridJobRate(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-slate-100 font-bold"
                                          value={calculatedJobAmt}
                                          disabled
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="text"
                                          className="w-full h-6 px-1 border-none text-center bg-transparent"
                                          value={gridCP}
                                          onChange={(e) => setGridCP(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="text"
                                          className="w-full h-6 px-1 border-none text-center bg-transparent"
                                          value={gridTp}
                                          onChange={(e) => setGridTp(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <select
                                          className="w-full h-6 px-1 border-none bg-transparent text-[10px] focus:outline-none uppercase font-bold"
                                          value={gridFinishItem}
                                          onChange={(e) => setGridFinishItem(e.target.value)}
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
                                          value={gridCut}
                                          onChange={(e) => handleCutChange(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <input
                                          type="number"
                                          className="w-full h-6 px-1 border-none text-right bg-transparent"
                                          value={gridFPcs}
                                          onChange={(e) => handleFPcsChange(e.target.value)}
                                       />
                                    </td>
                                    <td className="border-r border-slate-300 p-0.5">
                                       <select
                                          className="w-full h-6 px-1 border-none bg-transparent text-[10px] focus:outline-none"
                                          value={gridProcType}
                                          onChange={(e) => setGridProcType(e.target.value)}
                                       >
                                          <option value="">- Select -</option>
                                          <option value="Finish">Finish</option>
                                          <option value="Refinish">Refinish</option>
                                          <option value="Return">Return</option>
                                       </select>
                                    </td>
                                    <td className="p-0.5">
                                       <input
                                          type="text"
                                          className="w-full h-6 px-1 border-none bg-transparent"
                                          value={gridCuttingPending}
                                          onChange={(e) => setGridCuttingPending(e.target.value)}
                                       />
                                    </td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>

                        {/* 3. SUMMARY BAR */}
                        <div className="bg-[#0f766e] text-white text-[11px] font-bold px-3 py-1 flex justify-between items-center uppercase border border-[#0d6059]">
                           <div>TOTAL PCS : {Number(gridFPcs) || 0}</div>
                           <div>Send.Mts : {Number(gridGreyMts) || 0}</div>
                           <div>Rec.Mts : {Number(gridFinishMts) || 0}</div>
                           <div>FnsPcs : {Number(gridFPcs) || 0}</div>
                           <div>(Snd.Kgs : 0 &middot; Rec.Kgs : 0)</div>
                        </div>

                        {/* 4. FOOTER MULTI-COLUMN ADJUSTMENTS */}
                        <div className="grid grid-cols-12 gap-2 text-[11px] p-2 border border-[#808080] bg-[#d4d0c8]">

                           {/* Column 1: Adjustments (4 cols) */}
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

                           {/* Column 2: TDS Details (2.5 cols) */}
                           <div className="col-span-2.5 space-y-1.5 border-r border-[#a0a0a0] px-2">
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

                           {/* Column 3: GST Details (3 cols) */}
                           <div className="col-span-3 space-y-1.5 border-r border-[#a0a0a0] px-2">
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">SGST %:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={sgstPercent}
                                    onChange={(e) => setSgstPercent(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={computedSgstAmt}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">CGST %:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={cgstPercent}
                                    onChange={(e) => setCgstPercent(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={computedCgstAmt}
                                    disabled
                                 />
                              </div>
                              <div className="flex items-center gap-1">
                                 <span className="w-16 text-slate-800 font-semibold text-right">IGST %:</span>
                                 <input
                                    type="number"
                                    className="classic-erp-input w-12 text-center bg-white"
                                    value={igstPercent}
                                    onChange={(e) => setIgstPercent(e.target.value)}
                                 />
                                 <input
                                    type="number"
                                    className="classic-erp-input flex-1 text-right bg-white"
                                    value={computedIgstAmt}
                                    disabled
                                 />
                              </div>
                           </div>

                           {/* Column 4: Totals Block (3.5 cols) */}
                           <div className="col-span-3.5 space-y-1 pl-2">
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

                        {/* 5. ACTION BUTTONS FOOTER BAR */}
                        <div className="flex flex-col gap-2 p-2 border border-[#808080] bg-[#d4d0c8]">

                           {/* Row 1: Primary Toolbar */}
                           <div className="flex justify-start gap-1 flex-wrap">
                              <button type="button" className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">New</button>
                              <button type="button" className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Edit</button>
                              <button
                                 type="submit"
                                 onClick={handleSubmit}
                                 disabled={saving || !selectedJobId}
                                 className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]"
                              >
                                 <SaveButtonLabel saving={saving} idle="Save" busy="Saving…" />
                              </button>
                              <button type="button" onClick={onClose} className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Cancel</button>
                              <button type="button" className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Find</button>
                              <button type="button" className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Sp.Find</button>
                              <button type="button" className="px-5 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1] text-red-800">Delete</button>
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
                                 <button type="button" className="px-4 py-1 text-[11px] font-bold border border-red-400 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200">Payment Entry</button>
                                 <button type="button" className="px-4 py-1 text-[11px] font-bold border border-slate-400 bg-[#e2e8f0] active:bg-[#cbd5e1]">Print</button>
                              </div>
                           </div>

                        </div>

                     </div>
                  ) : (
                     // View Mill Rec list tab
                     <div className="flex-1 flex flex-col overflow-hidden bg-white border border-[#808080]">
                        <div className="classic-erp-table-container flex-1">
                           <table className="classic-erp-table">
                              <thead>
                                 <tr>
                                    <th className="w-24">Date</th>
                                    <th className="w-32">Job Card No</th>
                                    <th>Mill Partner</th>
                                    <th className="w-28">Process</th>
                                    <th className="w-28 text-right">Issued Qty</th>
                                    <th className="w-28 text-right">Received Qty</th>
                                    <th className="w-28 text-right">Wastage Qty</th>
                                    <th className="w-24 text-center">Status</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {receivedJobs.map((job) => (
                                    <tr key={job._id}>
                                       <td className="font-mono">{job.receiveDate ? new Date(job.receiveDate).toLocaleDateString() : 'N/A'}</td>
                                       <td className="font-bold text-blue-900">{job.jobCardNo}</td>
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
                                    </tr>
                                 ))}
                                 {receivedJobs.length === 0 && (
                                    <tr>
                                       <td colSpan="8" className="py-8 text-center text-slate-400 font-bold uppercase">
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
                                       <th className="p-1 text-right">Issued Qty</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {associatedLots.length > 0 ? (
                                       associatedLots.map((job, i) => (
                                          <tr
                                             key={job._id}
                                             onClick={() => {
                                                handleSelectLot(job);
                                                setShowLotDropdown(false);
                                             }}
                                             onMouseEnter={() => setDropdownSelectIdx(i)}
                                             className={`border-b border-slate-200 cursor-pointer ${i === dropdownSelectIdx ? 'bg-blue-600 text-white' : 'hover:bg-sky-100 text-slate-900'}`}
                                          >
                                             <td className={`p-1.5 border-r border-slate-200 font-bold ${i === dropdownSelectIdx ? 'text-white' : 'text-blue-900'}`}>{job.challanNo || job.jobCardNo}</td>
                                             <td className="p-1.5 border-r border-slate-200">{job.lotId?.lotId || job.lotId || 'N/A'}</td>
                                             <td className="p-1.5 border-r border-slate-200 uppercase font-sans">{job.lotId?.itemId?.name || job.lotId?.itemName || 'N/A'}</td>
                                             <td className="p-1.5 text-right font-bold">{job.issueQty} Mts</td>
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

            </div>
         )}
      </ErpWindowedModal>
   );
};

export default ReceiveModal;
