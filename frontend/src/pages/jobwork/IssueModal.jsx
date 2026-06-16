import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const IssueModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { 
    parties, 
    inventoryLots, 
    jobWorkEntries, 
    fetchParties, 
    fetchInventory, 
    fetchJobs, 
    issueToMill 
  } = useStore();

  const [activeTab, setActiveTab] = useState('Mill Issue');
  const [selectedLot, setSelectedLot] = useState(null);
  const [saving, setSaving] = useState(false);

  const [header, setHeader] = useState({
    processType: 'Printing',
    jobCardNo: '',
    date: new Date().toISOString().substring(0, 10),
    workerId: '',
    issuePcs: '',
    issueQty: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      fetchInventory();
      fetchJobs();
      // Auto-generate job card no
      setHeader(prev => ({
        ...prev,
        jobCardNo: 'AUTO'
      }));
    }
  }, [isOpen, fetchParties, fetchInventory, fetchJobs]);

  const workers = useMemo(() => {
    return parties.filter(p => p.type === 'Job Worker');
  }, [parties]);

  const availableLots = useMemo(() => {
    return inventoryLots.filter(lot => lot.remainingMtrs > 0 && lot.status !== 'Closed');
  }, [inventoryLots]);

  const handleSelectLot = (lot) => {
    setSelectedLot(lot);
    setHeader(prev => ({
      ...prev,
      issuePcs: lot.remainingPcs || '',
      issueQty: lot.remainingMtrs || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLot) {
      alert('Please select an available lot from the right panel first.');
      return;
    }
    if (!header.workerId) {
      alert('Please select a Job Worker / Mill Party.');
      return;
    }
    if (!header.issueQty || parseFloat(header.issueQty) <= 0) {
      alert('Please enter a valid issue quantity.');
      return;
    }

    setSaving(true);
    try {
      await issueToMill({
        jobCardNo: header.jobCardNo,
        lotId: selectedLot._id,
        workerId: header.workerId,
        processType: header.processType,
        issuePcs: Number(header.issuePcs) || 0,
        issueQty: Number(header.issueQty),
        issueDate: new Date(header.date)
      });
      alert('Job issued to mill successfully!');
      setSelectedLot(null);
      // Reset form
      setHeader(prev => ({
        ...prev,
        jobCardNo: 'AUTO',
        workerId: '',
        issuePcs: '',
        issueQty: ''
      }));
      setActiveTab('View Mill Issue');
      fetchInventory();
      fetchJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to issue lot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Issue to Mill (Process Work)" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b border-[#E2E8F0] p-1 bg-slate-50 gap-1 shrink-0">
         {['Mill Issue', 'View Mill Issue'].map(tab => (
            <button 
             key={tab}
             type="button"
             onClick={() => setActiveTab(tab)}
             className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab 
                   ? 'bg-white text-black shadow-sm border border-[#E2E8F0]' 
                   : 'text-slate-500 hover:bg-slate-100'
             }`}
            >
              {tab}
            </button>
         ))}
      </div>

      <div className="flex flex-col h-full overflow-hidden bg-white">
        
        {activeTab === 'Mill Issue' ? (
          <div className="flex-1 flex overflow-hidden">
             {/* Left Form (70%) */}
             <form onSubmit={handleSubmit} className="flex-[3] flex flex-col overflow-y-auto p-5 space-y-6 no-scrollbar pb-32">
                
                <div className="erp-form-section mt-0">
                   <div className="erp-form-section-header">
                      <span className="erp-form-section-title">Process Specifications</span>
                   </div>

                   {/* Form details */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="erp-field">
                         <label className="erp-label">Job Card No</label>
                         <ERPInput 
                           className="w-full bg-[var(--bg-base)]" 
                           value={header.jobCardNo} 
                           readOnly
                         />
                      </div>

                      <div className="erp-field">
                         <label className="erp-label">Challan Date</label>
                         <input 
                           type="date" 
                           className="erp-input w-full" 
                           value={header.date} 
                           onChange={e => setHeader({...header, date: e.target.value})} 
                           required
                         />
                      </div>

                      <div className="erp-field">
                         <label className="erp-label">Job Worker / Mill Party</label>
                         <ERPSelect 
                           className="w-full" 
                           value={header.workerId}
                           onChange={(e) => setHeader({...header, workerId: e.target.value})}
                           options={[{value: '', label: 'Select Worker'}, ...workers.map(w => ({value: w._id, label: w.name}))]} 
                           required
                         />
                      </div>

                      <div className="erp-field">
                         <label className="erp-label">Process Type</label>
                         <ERPSelect 
                           className="w-full" 
                           value={header.processType}
                           onChange={(e) => setHeader({...header, processType: e.target.value})}
                           options={[
                             { value: 'Printing', label: 'Printing' },
                             { value: 'Dyeing', label: 'Dyeing' },
                             { value: 'Stitching', label: 'Stitching' },
                             { value: 'Finishing', label: 'Finishing' },
                           ]} 
                           required
                         />
                      </div>
                   </div>
                </div>

                <div className="erp-form-section">
                   <div className="erp-form-section-header">
                      <span className="erp-form-section-title">Selected Lot Stock Issue Details</span>
                   </div>

                {selectedLot ? (
                  <div className="bg-[var(--bg-card)] p-4 border border-[var(--border-strong)] rounded-lg space-y-4 shadow-sm animate-fade-in-up">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Selected Lot ID</p>
                        <p className="text-[var(--text-primary)] font-bold uppercase mt-1">{selectedLot.lotId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Fabric Item</p>
                        <p className="text-[var(--text-primary)] font-bold uppercase mt-1">{selectedLot.itemId?.name || selectedLot.itemName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Available Pcs</p>
                        <p className="text-[var(--text-primary)] font-bold mt-1">{selectedLot.remainingPcs} Pcs</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Available Meters</p>
                        <p className="text-[var(--text-primary)] font-bold mt-1">{selectedLot.remainingMtrs} Mtrs</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                      <div className="erp-field">
                         <label className="erp-label">Issue Pcs</label>
                         <input 
                            type="number" 
                            className="erp-input w-full font-bold text-[14px]" 
                            value={header.issuePcs} 
                            onChange={e => setHeader({...header, issuePcs: e.target.value})}
                            max={selectedLot.remainingPcs}
                            placeholder="0"
                         />
                      </div>
                      <div className="erp-field">
                         <label className="erp-label">Issue Meters (Qty)</label>
                         <input 
                            type="number" 
                            className="erp-input w-full font-bold text-[14px]" 
                            value={header.issueQty} 
                            onChange={e => setHeader({...header, issueQty: e.target.value})}
                            max={selectedLot.remainingMtrs}
                            placeholder="0.00"
                            required
                         />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 border-2 border-dashed border-[var(--border)] rounded-lg text-center text-[var(--text-muted)] font-semibold uppercase tracking-widest text-[11px] bg-[var(--bg-base)] animate-fade-in">
                     Select a Grey Lot from the Available Lots panel to continue
                  </div>
                )}
                </div>

                {/* Footer Actions inside form */}
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
                      disabled={saving}
                      className="erp-btn erp-btn-primary px-8"
                   >
                      {saving ? 'Processing...' : 'Confirm Issue'} to Mill
                   </button>
                </div>

             </form>

             {/* Lot Selector Card Grid (Right Column 30%) */}
             <div className="flex-1 flex flex-col bg-slate-50 border-l border-[#E2E8F0] overflow-hidden">
                <div className="bg-black text-white text-xs px-4 h-[56px] flex justify-between items-center font-bold tracking-wider uppercase shrink-0">
                   <span>Available Lots</span>
                   <span className="px-2 py-0.5 bg-white/10 rounded text-[9px]">Select to Load</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                   {availableLots.map(lot => {
                      const isSelected = selectedLot?._id === lot._id;
                      return (
                        <div 
                           key={lot._id}
                           onClick={() => handleSelectLot(lot)}
                           className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                             isSelected ? 'border-black ring-1 ring-black' : 'border-[#E2E8F0]'
                           }`}
                        >
                           <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-black text-black tracking-wide">{lot.lotId}</span>
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-full uppercase tracking-wider">
                                 {lot.itemId?.category || lot.category || 'Grey'}
                              </span>
                           </div>
                           <div className="space-y-1 mt-2">
                             <div className="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Fabric</span>
                                <span className="font-bold text-slate-700 uppercase">{lot.itemId?.name || lot.itemName}</span>
                             </div>
                             <div className="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Meters</span>
                                <span className="font-black text-black">{lot.remainingMtrs.toFixed(2)} Mtrs</span>
                             </div>
                           </div>
                        </div>
                      );
                   })}
                   {availableLots.length === 0 && (
                     <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                        No grey fabric lots in stock
                     </div>
                   )}
                </div>
             </div>
          </div>
        ) : (
          // View Mill Issue list tab
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
                         <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-[11px]">
                      {jobWorkEntries.map((job) => (
                         <tr key={job._id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-medium">{new Date(job.issueDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-bold text-black uppercase">{job.jobCardNo}</td>
                            <td className="px-4 py-3 font-semibold uppercase">{job.workerId?.name || 'N/A'}</td>
                            <td className="px-4 py-3 text-slate-500 uppercase font-medium">{job.processType}</td>
                            <td className="px-4 py-3 text-right font-black">{job.issueQty} Mtrs</td>
                            <td className="px-4 py-3 text-center">
                               <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                 job.status === 'Received' 
                                   ? 'bg-green-50 text-green-700 border border-green-150' 
                                   : 'bg-amber-50 text-amber-700 border border-amber-150'
                               }`}>
                                  {job.status}
                               </span>
                            </td>
                         </tr>
                      ))}
                      {jobWorkEntries.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                            No Issued Jobs Found
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

export default IssueModal;
