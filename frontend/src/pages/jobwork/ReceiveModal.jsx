import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const ReceiveModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { 
    jobWorkEntries, 
    fetchJobs, 
    receiveFromMill,
    fetchInventory
  } = useStore();

  const [activeTab, setActiveTab] = useState('Mill Receive');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [receivedPcs, setReceivedPcs] = useState('');
  const [receivedQty, setReceivedQty] = useState('');
  const [rate, setRate] = useState('');
  const [gstPercent, setGstPercent] = useState('5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
    }
  }, [isOpen, fetchJobs]);

  const pendingJobs = useMemo(() => {
    return jobWorkEntries.filter(j => j.status === 'Issued');
  }, [jobWorkEntries]);

  const receivedJobs = useMemo(() => {
    return jobWorkEntries.filter(j => j.status === 'Received');
  }, [jobWorkEntries]);

  const selectedJob = useMemo(() => {
    return jobWorkEntries.find(j => j._id === selectedJobId) || null;
  }, [selectedJobId, jobWorkEntries]);

  // Auto-fill values when job changes
  useEffect(() => {
    if (selectedJob) {
      setReceivedPcs(selectedJob.issuePcs || '');
      setReceivedQty(selectedJob.issueQty || '');
      // If worker type has a custom rate stored, or default it
      let defaultRate = 10;
      try {
        if (selectedJob.workerId?.address && selectedJob.workerId?.address.startsWith('{')) {
          const extra = JSON.parse(selectedJob.workerId.address);
          if (extra.rate) defaultRate = extra.rate;
        }
      } catch (e) {}
      setRate(defaultRate);
    } else {
      setReceivedPcs('');
      setReceivedQty('');
      setRate('');
    }
  }, [selectedJob]);

  // Derived Calculations
  const calculatedWastage = useMemo(() => {
    if (!selectedJob || !receivedQty) return 0;
    return Math.max(0, selectedJob.issueQty - Number(receivedQty));
  }, [selectedJob, receivedQty]);

  const wastagePercent = useMemo(() => {
    if (!selectedJob || !selectedJob.issueQty) return 0;
    return (calculatedWastage / selectedJob.issueQty) * 100;
  }, [selectedJob, calculatedWastage]);

  const charges = useMemo(() => {
    return (Number(receivedQty) || 0) * (Number(rate) || 0);
  }, [receivedQty, rate]);

  const gstAmount = useMemo(() => {
    return (charges * (Number(gstPercent) || 0)) / 100;
  }, [charges, gstPercent]);

  const totalAmount = useMemo(() => {
    return charges + gstAmount;
  }, [charges, gstAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJobId) {
      alert('Please select a pending process job card');
      return;
    }
    if (!receivedQty || parseFloat(receivedQty) <= 0) {
      alert('Please enter a valid received quantity');
      return;
    }

    setSaving(true);
    try {
      await receiveFromMill({
        jobId: selectedJobId,
        receivedQty: Number(receivedQty),
        receivedPcs: Number(receivedPcs) || 0,
        wastage: Number(calculatedWastage),
        charges: Number(charges),
        gstAmount: Number(gstAmount)
      });
      alert('Challan received and finished lots added to stock!');
      setSelectedJobId('');
      setActiveTab('View Mill Rec');
      await fetchJobs();
      await fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to receive job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mill Receive Receipt" className="max-w-[95vw] h-[90vh] classic-erp-window p-0 border-0">
      <div className="classic-erp-window flex flex-col h-full overflow-hidden">
        {/* Title Bar */}
        <div className="classic-erp-header shrink-0">
          <span>Mill Receive Receipt [ {selectedBook || 'RECEIVE BOOK'} ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {/* Tab Navigation */}
        <div className="classic-erp-tabs shrink-0">
          {['Mill Receive', 'View Mill Rec'].map(tab => (
            <button 
             key={tab}
             type="button"
             onClick={() => setActiveTab(tab)}
             className={`classic-erp-tab-button ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-base)] p-2">
          {activeTab === 'Mill Receive' ? (
            <div className="flex-1 flex overflow-hidden gap-2">
               {/* Left Form Column (70%) */}
               <form onSubmit={handleSubmit} className="flex-[3] flex flex-col overflow-y-auto space-y-2 no-scrollbar pb-16 relative">
                  
                  <div className="classic-erp-frame space-y-2">
                     <div className="classic-erp-frame-title">Receive Specs & Logistics</div>

                     {/* Form Info */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                           <span className="classic-erp-label w-32">Pending Job Card:</span>
                           <select 
                             className="classic-erp-select flex-1"
                             value={selectedJobId}
                             onChange={(e) => setSelectedJobId(e.target.value)}
                             required
                           >
                             <option value="">- Select Job Card -</option>
                             {pendingJobs.map(j => (
                               <option key={j._id} value={j._id}>
                                 {j.jobCardNo} - {j.workerId?.name} ({j.processType})
                               </option>
                             ))}
                           </select>
                        </div>

                        <div className="flex items-center gap-2">
                           <span className="classic-erp-label w-24">Receive Date:</span>
                           <input 
                             type="date" 
                             className="classic-erp-input flex-1" 
                             defaultValue={new Date().toISOString().substring(0, 10)} 
                             readOnly
                           />
                        </div>
                     </div>
                  </div>

                  {selectedJob ? (
                    <div className="classic-erp-frame space-y-2">
                      <div className="classic-erp-frame-title">Job Card Original vs Received Allocation</div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono border-b border-[#808080] pb-2">
                        <div>
                          <span className="classic-erp-label text-slate-800">Issued Lot Ref:</span>
                          <span className="font-bold text-black uppercase ml-1">{selectedJob.lotId?.lotId || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="classic-erp-label text-slate-800">Worker / Unit:</span>
                          <span className="font-bold text-black uppercase ml-1">{selectedJob.workerId?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="classic-erp-label text-slate-800">Original Issued Pcs:</span>
                          <span className="font-bold text-black ml-1">{selectedJob.issuePcs} Pcs</span>
                        </div>
                        <div>
                          <span className="classic-erp-label text-slate-800">Original Issued Mts:</span>
                          <span className="font-bold text-black ml-1">{selectedJob.issueQty} Mtrs</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                        <div className="flex items-center gap-1">
                           <span className="classic-erp-label text-[11px] w-12">Rec Pcs:</span>
                           <input 
                              type="number" 
                              className="classic-erp-input flex-1 font-bold text-right" 
                              value={receivedPcs} 
                              onChange={e => setReceivedPcs(e.target.value)}
                              max={selectedJob.issuePcs}
                              placeholder="0"
                           />
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="classic-erp-label red-label text-[11px] w-12">Rec Mts:</span>
                           <input 
                              type="number" 
                              className="classic-erp-input flex-1 font-bold text-right" 
                              value={receivedQty} 
                              onChange={e => setReceivedQty(e.target.value)}
                              max={selectedJob.issueQty}
                              placeholder="0.00"
                              required
                           />
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="classic-erp-label text-[11px] w-16">Proc Rate:</span>
                           <input 
                              type="number" 
                              className="classic-erp-input flex-1 text-right" 
                              value={rate} 
                              onChange={e => setRate(e.target.value)}
                              placeholder="0.00"
                           />
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="classic-erp-label text-[11px] w-16">GST Slab:</span>
                           <select 
                              className="classic-erp-select flex-1" 
                              value={gstPercent} 
                              onChange={e => setGstPercent(e.target.value)}
                           >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                           </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-red-800 font-bold uppercase tracking-wider text-[11px] bg-white border border-[#808080]">
                       SELECT A PENDING ISSUED CHALLAN FROM THE DROPDOWN TO CONTINUE
                    </div>
                  )}

                  {/* Footer Actions inside form */}
                  <div className="classic-erp-form-footer absolute bottom-0 left-0 w-full shrink-0">
                     <button 
                        type="button" 
                        onClick={onClose}
                        className="classic-erp-btn"
                     >
                        Cancel
                     </button>
                     <button 
                        type="submit"
                        disabled={saving || !selectedJobId}
                        onClick={handleSubmit}
                        className="classic-erp-btn btn-blue"
                     >
                        {saving ? 'Saving...' : 'Receive Job Work'}
                     </button>
                  </div>

               </form>

               {/* Yield & Wastage Monitor (Right Column 30%) */}
               <div className="flex-1 flex flex-col w-80 shrink-0 classic-erp-frame p-0 overflow-hidden bg-white">
                  <div className="classic-erp-header bg-black text-white text-xs px-2 h-7 flex justify-between items-center font-bold uppercase shrink-0">
                     <span>Yield & Wastage Monitor</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-3 no-scrollbar font-mono">
                      
                      <div className="border border-[#808080] p-2 space-y-1.5 bg-[#d4d0c8]">
                         <span className="text-[10px] font-bold uppercase text-blue-900 block">Metrics Overview</span>
                         
                         <div className="flex justify-between items-center text-xs">
                            <span className="classic-erp-label text-slate-700">Issued:</span>
                            <span className="font-bold text-black">{selectedJob ? selectedJob.issueQty.toFixed(2) : '0.00'} mts</span>
                         </div>

                         <div className="flex justify-between items-center text-xs border-t border-[#808080] pt-1">
                            <span className="classic-erp-label text-slate-700">Received:</span>
                            <span className="font-bold text-black">{receivedQty ? Number(receivedQty).toFixed(2) : '0.00'} mts</span>
                         </div>
                      </div>

                      <div className="border border-[#808080] p-2" style={{ backgroundColor: wastagePercent > 10 ? '#ffffe1' : '#ffffff' }}>
                         <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-700">Computed Wastage:</span>
                            {wastagePercent > 10 ? (
                               <span className="px-1 bg-red-800 text-white text-[9px] font-bold uppercase animate-pulse">
                                  CRITICAL
                               </span>
                            ) : (
                               <span className="px-1 bg-green-800 text-white text-[9px] font-bold uppercase">
                                  OPTIMAL
                               </span>
                            )}
                         </div>

                         <div className="text-3xl font-black text-slate-900">
                            {wastagePercent.toFixed(1)}%
                         </div>
                         <p className="text-[10px] text-slate-600 leading-normal mt-1">
                            Wastage quantity is <span className="font-bold text-black">{calculatedWastage.toFixed(2)}</span> meters.
                         </p>
                      </div>

                      <div className="bg-[#eff6ff] border border-blue-300 p-2 text-[10px] text-slate-700 leading-relaxed font-sans">
                         <span className="font-bold text-blue-900 block mb-1">Wastage Tolerance Policy</span>
                         Maximum allowable shrinkage/wastage during process is 10%. Over-wastage will deduct processing charges automatically.
                      </div>
                  </div>
               </div>
            </div>
          ) : (
            // View Mill Rec list tab
            <div className="flex-1 flex flex-col overflow-hidden">
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
      </div>
    </Modal>
  );
};

export default ReceiveModal;
