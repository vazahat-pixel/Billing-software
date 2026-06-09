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
      alert('Challan received and finishes lots added to stock!');
      setSelectedJobId('');
      setActiveTab('View Mill Rec');
      fetchJobs();
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to receive job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mill Receive Receipt" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b-2 border-black p-0 bg-white gap-0 shrink-0">
         {['Mill Receive', 'View Mill Rec'].map(tab => (
            <button 
             key={tab}
             type="button"
             onClick={() => setActiveTab(tab)}
             className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                   ? 'bg-black text-white' 
                   : 'text-slate-400 hover:bg-slate-50'
             }`}
            >
              {tab}
            </button>
         ))}
      </div>

      <div className="flex flex-col h-full overflow-hidden bg-white">
        
        {activeTab === 'Mill Receive' ? (
          <div className="flex-1 flex overflow-hidden">
             {/* Left Form Column (70%) */}
             <form onSubmit={handleSubmit} className="flex-[3] flex flex-col overflow-y-auto p-5 space-y-4 no-scrollbar">
                
                <div className="flex items-center gap-3">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Receive Specs & Logistics</span>
                   <div className="h-[2px] flex-1 bg-black" />
                </div>

                {/* Form Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-black tracking-widest">Pending Job Cards</label>
                      <ERPSelect 
                        className="w-full h-11 border-2 border-slate-100 focus:border-black font-bold text-black"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        options={[
                          { value: '', label: 'Select Job Card' },
                          ...pendingJobs.map(j => ({
                            value: j._id,
                            label: `${j.jobCardNo} - ${j.workerId?.name} (${j.processType})`
                          }))
                        ]}
                        required
                      />
                   </div>

                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-black tracking-widest">Receive Date</label>
                      <input 
                        type="date" 
                        className="w-full h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white transition-all" 
                        defaultValue={new Date().toISOString().substring(0, 10)} 
                        readOnly
                      />
                   </div>
                </div>

                {selectedJob && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pt-2">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Job Card Original vs Received Allocation</span>
                       <div className="h-[2px] flex-1 bg-black" />
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 font-bold uppercase">Issued Lot Ref</p>
                        <p className="text-black font-black uppercase mt-1">{selectedJob.lotId?.lotId || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold uppercase">Worker / Unit</p>
                        <p className="text-black font-black uppercase mt-1">{selectedJob.workerId?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold uppercase">Original Issued Pcs</p>
                        <p className="text-black font-black mt-1">{selectedJob.issuePcs} Pcs</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold uppercase">Original Issued Meters</p>
                        <p className="text-black font-black mt-1">{selectedJob.issueQty} Mtrs</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="flex flex-col gap-1">
                         <label className="text-[10px] font-black uppercase text-black tracking-widest">Rec Pcs</label>
                         <input 
                            type="number" 
                            className="h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white" 
                            value={receivedPcs} 
                            onChange={e => setReceivedPcs(e.target.value)}
                            max={selectedJob.issuePcs}
                            placeholder="0"
                         />
                      </div>
                      <div className="flex flex-col gap-1">
                         <label className="text-[10px] font-black uppercase text-black tracking-widest">Rec Meters</label>
                         <input 
                            type="number" 
                            className="h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white" 
                            value={receivedQty} 
                            onChange={e => setReceivedQty(e.target.value)}
                            max={selectedJob.issueQty}
                            placeholder="0.00"
                            required
                         />
                      </div>
                      <div className="flex flex-col gap-1">
                         <label className="text-[10px] font-black uppercase text-black tracking-widest">Processing Rate (₹)</label>
                         <input 
                            type="number" 
                            className="h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white" 
                            value={rate} 
                            onChange={e => setRate(e.target.value)}
                            placeholder="0.00"
                         />
                      </div>
                      <div className="flex flex-col gap-1">
                         <label className="text-[10px] font-black uppercase text-black tracking-widest">GST Rate (%)</label>
                         <ERPSelect 
                            className="h-11 border-2 border-slate-100 focus:border-black font-bold" 
                            value={gstPercent} 
                            onChange={e => setGstPercent(e.target.value)}
                            options={[
                              { value: '0', label: '0%' },
                              { value: '5', label: '5%' },
                              { value: '12', label: '12%' },
                              { value: '18', label: '18%' },
                            ]}
                         />
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold text-slate-500">
                      <div>
                         <p className="uppercase">Base Job Cost</p>
                         <p className="text-black font-black text-sm mt-1">₹ {charges.toFixed(2)}</p>
                      </div>
                      <div>
                         <p className="uppercase">GST Amount</p>
                         <p className="text-black font-black text-sm mt-1">₹ {gstAmount.toFixed(2)}</p>
                      </div>
                      <div>
                         <p className="uppercase">Total charges</p>
                         <p className="text-black font-black text-sm mt-1">₹ {totalAmount.toFixed(2)}</p>
                      </div>
                      <div>
                         <p className="uppercase">Calculated Wastage</p>
                         <p className="text-red-600 font-black text-sm mt-1">{calculatedWastage.toFixed(2)} Mtrs</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedJobId === '' && (
                  <div className="py-16 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 font-semibold uppercase tracking-widest text-[11px]">
                     Select a pending issued job card from the dropdown to continue
                  </div>
                )}

                {/* Action Footer inside form */}
                <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0 mt-6">
                   <button 
                      type="button" 
                      onClick={onClose}
                      className="px-8 py-2 bg-transparent border border-black text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all rounded-lg"
                   >
                      Cancel
                   </button>
                   <button 
                      type="submit"
                      disabled={saving || !selectedJobId}
                      className="px-12 py-2 bg-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-lg disabled:opacity-50"
                   >
                      {saving ? 'Saving...' : 'Save Receipt (F12)'}
                   </button>
                </div>

             </form>

             {/* Yield & Wastage Monitor (Right Column 30%) */}
             <div className="flex-1 flex flex-col bg-white border-l-2 border-black overflow-hidden">
                <div className="bg-black text-white text-[10px] px-6 h-[56px] flex justify-between items-center font-black uppercase tracking-widest shrink-0">
                   <span>Yield & Wastage Monitor</span>
                   <span className="px-3 py-1 bg-white text-black rounded-none">Real-time audit</span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
                   
                    <div className="bg-white border-2 border-black p-5 space-y-4 shadow-none">
                       <span className="text-[10px] font-black uppercase text-black tracking-[0.2em]">Metrics Overview</span>
                       
                       <div className="flex justify-between items-center py-1">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Issued (Grey Fabric)</span>
                          <span className="text-sm font-black text-black">{selectedJob ? selectedJob.issueQty.toFixed(2) : '0.00'} mts</span>
                       </div>

                       <div className="flex justify-between items-center py-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Received (Finished)</span>
                          <span className="text-sm font-black text-black">{receivedQty ? Number(receivedQty).toFixed(2) : '0.00'} mts</span>
                       </div>
                    </div>

                    <div className={`border-2 p-5 transition-all ${
                       wastagePercent > 10 
                          ? 'bg-black border-black text-white' 
                          : 'bg-white border-black text-black'
                    }`}>
                       <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest">Computed Wastage</span>
                          {wastagePercent > 10 ? (
                             <span className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-widest animate-pulse">
                                CRITICAL ({'>'}10%)
                             </span>
                          ) : (
                             <span className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest">
                                OPTIMAL
                             </span>
                          )}
                       </div>

                       <div className="text-4xl font-black mb-2">
                          {wastagePercent.toFixed(1)}%
                       </div>
                       <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed ${wastagePercent > 10 ? 'text-slate-400' : 'text-slate-500'}`}>
                          Wastage quantity is {calculatedWastage.toFixed(2)} meters of issued fabric.
                       </p>
                    </div>

                    {/* Diagnostic Helper Info */}
                    <div className="bg-slate-50 border-2 border-slate-100 p-5 text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                       <p className="text-black mb-2 border-b border-slate-200 pb-2">Wastage Tolerance Policy:</p>
                       Maximum allowable shrinkage/wastage during process is 10%. Over-wastage will deduct processing charges automatically.
                    </div>

                </div>
             </div>
          </div>
        ) : (
          // View Mill Rec list tab
          <div className="flex-1 p-6 overflow-y-auto">
             <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                   <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200">
                      <tr className="h-10">
                         <th className="px-4 py-3">Date</th>
                         <th className="px-4 py-3">Job Card No</th>
                         <th className="px-4 py-3">Mill Partner</th>
                         <th className="px-4 py-3">Process</th>
                         <th className="px-4 py-3 text-right">Issued Qty</th>
                         <th className="px-4 py-3 text-right">Received Qty</th>
                         <th className="px-4 py-3 text-right">Wastage Qty</th>
                         <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-[11px]">
                      {receivedJobs.map((job) => (
                         <tr key={job._id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-medium">{job.receiveDate ? new Date(job.receiveDate).toLocaleDateString() : 'N/A'}</td>
                            <td className="px-4 py-3 font-bold text-black uppercase">{job.jobCardNo}</td>
                            <td className="px-4 py-3 font-semibold uppercase">{job.workerId?.name || 'N/A'}</td>
                            <td className="px-4 py-3 text-slate-500 uppercase font-medium">{job.processType}</td>
                            <td className="px-4 py-3 text-right font-bold">{job.issueQty} Mtrs</td>
                            <td className="px-4 py-3 text-right font-black text-green-700">{job.receivedQty} Mtrs</td>
                            <td className="px-4 py-3 text-right font-black text-red-600">{job.wastage} Mtrs</td>
                            <td className="px-4 py-3 text-center">
                               <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-black text-white">
                                  {job.status}
                               </span>
                            </td>
                         </tr>
                      ))}
                      {receivedJobs.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
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

    </Modal>
  );
};

export default ReceiveModal;
