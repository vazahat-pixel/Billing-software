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
             <form onSubmit={handleSubmit} className="flex-[3] flex flex-col overflow-y-auto p-5 space-y-6 no-scrollbar pb-32">
                
                <div className="erp-form-section mt-0">
                   <div className="erp-form-section-header">
                      <span className="erp-form-section-title">Receive Specs & Logistics</span>
                   </div>

                   {/* Form Info */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="erp-field">
                         <label className="erp-label">Pending Job Cards</label>
                         <ERPSelect 
                           className="w-full"
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

                      <div className="erp-field">
                         <label className="erp-label">Receive Date</label>
                         <input 
                           type="date" 
                           className="erp-input w-full" 
                           defaultValue={new Date().toISOString().substring(0, 10)} 
                           readOnly
                         />
                      </div>
                   </div>
                </div>

                {selectedJob ? (
                  <div className="erp-form-section">
                    <div className="erp-form-section-header">
                       <span className="erp-form-section-title">Job Card Original vs Received Allocation</span>
                    </div>

                    <div className="bg-[var(--bg-card)] p-4 border border-[var(--border-strong)] rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] shadow-sm animate-fade-in-up">
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Issued Lot Ref</p>
                        <p className="text-[var(--text-primary)] font-bold uppercase mt-1">{selectedJob.lotId?.lotId || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Worker / Unit</p>
                        <p className="text-[var(--text-primary)] font-bold uppercase mt-1">{selectedJob.workerId?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Original Issued Pcs</p>
                        <p className="text-[var(--text-primary)] font-bold mt-1">{selectedJob.issuePcs} Pcs</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Original Issued Meters</p>
                        <p className="text-[var(--text-primary)] font-bold mt-1">{selectedJob.issueQty} Mtrs</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border-subtle)]">
                      <div className="erp-field">
                         <label className="erp-label">Rec Pcs</label>
                         <input 
                            type="number" 
                            className="erp-input w-full font-bold text-[14px]" 
                            value={receivedPcs} 
                            onChange={e => setReceivedPcs(e.target.value)}
                            max={selectedJob.issuePcs}
                            placeholder="0"
                         />
                      </div>
                      <div className="erp-field">
                         <label className="erp-label">Rec Meters</label>
                         <input 
                            type="number" 
                            className="erp-input w-full font-bold text-[14px]" 
                            value={receivedQty} 
                            onChange={e => setReceivedQty(e.target.value)}
                            max={selectedJob.issueQty}
                            placeholder="0.00"
                            required
                         />
                      </div>
                      <div className="erp-field">
                         <label className="erp-label">Processing Rate (₹)</label>
                         <input 
                            type="number" 
                            className="erp-input w-full" 
                            value={rate} 
                            onChange={e => setRate(e.target.value)}
                            placeholder="0.00"
                         />
                      </div>
                      <div className="erp-field">
                         <label className="erp-label">GST Rate (%)</label>
                         <ERPSelect 
                            className="w-full" 
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
                  </div>
                ) : (
                  <div className="py-12 border-2 border-dashed border-[var(--border)] rounded-lg text-center text-[var(--text-muted)] font-semibold uppercase tracking-widest text-[11px] bg-[var(--bg-base)] animate-fade-in">
                     Select a pending issued job card from the dropdown to continue
                  </div>
                )}
                </form>

                {/* Footer Actions */}
                <div className="erp-modal-footer absolute bottom-0 left-0 w-[70%] bg-[var(--bg-base)]">
                   <button 
                      type="button" 
                      onClick={onClose}
                      className="erp-btn erp-btn-secondary"
                   >
                      Cancel
                   </button>
                   <button 
                      type="submit"
                      disabled={saving || !selectedJobId}
                      onClick={handleSubmit}
                      className="erp-btn erp-btn-primary px-8"
                   >
                      {saving ? 'Processing...' : 'Receive Job Work'}
                   </button>
                </div>

             {/* Yield & Wastage Monitor (Right Column 30%) */}
             <div className="flex-1 flex flex-col bg-[var(--bg-card)] border-l border-[var(--border)] overflow-hidden relative">
                <div className="bg-[var(--bg-base)] text-[var(--text-primary)] px-6 py-4 flex justify-between items-center border-b border-[var(--border)] shrink-0">
                   <span className="font-semibold text-[14px]">Yield & Wastage Monitor</span>
                   <span className="px-2.5 py-1 bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-bold uppercase rounded tracking-wider">Real-time audit</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                   
                    <div className="erp-card p-5 space-y-4">
                       <span className="text-[11px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Metrics Overview</span>
                       
                       <div className="flex justify-between items-center py-2">
                          <span className="text-[12px] text-[var(--text-secondary)] font-medium">Issued (Grey Fabric)</span>
                          <span className="text-[14px] font-bold text-[var(--text-primary)]">{selectedJob ? selectedJob.issueQty.toFixed(2) : '0.00'} mts</span>
                       </div>

                       <div className="flex justify-between items-center py-2 border-t border-[var(--border-subtle)]">
                          <span className="text-[12px] text-[var(--text-secondary)] font-medium">Received (Finished)</span>
                          <span className="text-[14px] font-bold text-[var(--text-primary)]">{receivedQty ? Number(receivedQty).toFixed(2) : '0.00'} mts</span>
                       </div>
                    </div>

                    <div className={`erp-card p-5 transition-colors duration-300 ${
                       wastagePercent > 10 
                          ? 'bg-[var(--red)]/10 border-[var(--red)]/30' 
                          : 'bg-[var(--emerald)]/10 border-[var(--emerald)]/30'
                    }`}>
                       <div className="flex items-center justify-between mb-4">
                          <span className="text-[12px] font-bold uppercase text-[var(--text-secondary)] tracking-wider">Computed Wastage</span>
                          {wastagePercent > 10 ? (
                             <span className="px-2 py-0.5 bg-[var(--red)] text-white text-[10px] font-bold rounded shadow-sm animate-pulse">
                                CRITICAL ({'>'}10%)
                             </span>
                          ) : (
                             <span className="px-2 py-0.5 bg-[var(--emerald)] text-white text-[10px] font-bold rounded shadow-sm">
                                OPTIMAL
                             </span>
                          )}
                       </div>

                       <div className={`text-4xl font-black mb-2 ${wastagePercent > 10 ? 'text-[var(--red)]' : 'text-[var(--emerald)]'}`}>
                          {wastagePercent.toFixed(1)}%
                       </div>
                       <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-2 font-medium">
                          Wastage quantity is <span className="font-bold text-[var(--text-primary)]">{calculatedWastage.toFixed(2)}</span> meters of issued fabric.
                       </p>
                    </div>

                    <div className="bg-[var(--blue-bg)] border border-[var(--accent)]/20 rounded-lg p-4 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                       <p className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                          Wastage Tolerance Policy
                       </p>
                       Maximum allowable shrinkage/wastage during process is 10%. Over-wastage will deduct processing charges automatically.
                    </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto">
             <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
                <table className="erp-data-table">
                   <thead>
                      <tr>
                         <th>Date</th>
                         <th>Job Card No</th>
                         <th>Mill Partner</th>
                         <th>Process</th>
                         <th className="text-right">Issued Qty</th>
                         <th className="text-right">Received Qty</th>
                         <th className="text-right">Wastage Qty</th>
                         <th className="text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody>
                      {receivedJobs.map((job) => (
                         <tr key={job._id}>
                            <td>{job.receiveDate ? new Date(job.receiveDate).toLocaleDateString() : 'N/A'}</td>
                            <td className="font-semibold text-[var(--accent)]">{job.jobCardNo}</td>
                            <td className="font-medium">{job.workerId?.name || 'N/A'}</td>
                            <td>{job.processType}</td>
                            <td className="text-right">{job.issueQty} Mtrs</td>
                            <td className="text-right font-semibold text-[var(--emerald)]">{job.receivedQty} Mtrs</td>
                            <td className="text-right font-semibold text-[var(--red)]">{job.wastage} Mtrs</td>
                            <td className="text-center">
                               <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)]">
                                  {job.status}
                               </span>
                            </td>
                         </tr>
                      ))}
                      {receivedJobs.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-4 py-8 text-center text-[var(--text-muted)]">
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
