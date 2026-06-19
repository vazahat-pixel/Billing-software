import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const UpdateModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { 
    parties, 
    inventoryLots, 
    jobWorkEntries, 
    fetchParties, 
    fetchInventory, 
    fetchJobs, 
    issueToMill 
  } = useStore();

  const [activeTab, setActiveTab] = useState('Job Issue');
  const [selectedLot, setSelectedLot] = useState(null);

  const [header, setHeader] = useState({
    processType: 'Embroidery',
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
      // Auto-generate embroidery job card no
      setHeader(prev => ({
        ...prev,
        jobCardNo: `JC-EMB-${Math.floor(100000 + Math.random() * 900000)}`
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
      alert('Please select a Job Worker party.');
      return;
    }
    if (!header.issueQty || parseFloat(header.issueQty) <= 0) {
      alert('Please enter a valid issue quantity.');
      return;
    }

    try {
      await issueToMill({
        jobCardNo: header.jobCardNo,
        lotId: selectedLot._id,
        workerId: header.workerId,
        processType: 'Embroidery',
        issuePcs: Number(header.issuePcs) || 0,
        issueQty: Number(header.issueQty),
        issueDate: new Date(header.date)
      });
      alert('Embroidery job issued successfully!');
      setSelectedLot(null);
      // Reset form
      setHeader(prev => ({
        ...prev,
        jobCardNo: `JC-EMB-${Math.floor(100000 + Math.random() * 900000)}`,
        workerId: '',
        issuePcs: '',
        issueQty: ''
      }));
      setActiveTab('View Job Issue');
      fetchInventory();
      fetchJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to issue lot');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Embroidery Job Issue" className="max-w-[95vw] h-[90vh] classic-erp-window p-0 border-0">
      <div className="classic-erp-window flex flex-col h-full overflow-hidden">
        {/* Title Bar */}
        <div className="classic-erp-header shrink-0">
          <span>Embroidery Job Issue [ {selectedBook || 'EMB. JOBWORK'} ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {/* Tab Navigation */}
        <div className="classic-erp-tabs shrink-0">
          {['Job Issue', 'View Job Issue'].map(tab => (
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

        <div className="flex-1 flex flex-col overflow-hidden bg-[#d4d0c8] p-2">
          {activeTab === 'Job Issue' ? (
            <div className="flex-1 flex overflow-hidden gap-2">
               {/* Left Form (70%) */}
               <form onSubmit={handleSubmit} className="flex-[3] flex flex-col overflow-y-auto space-y-2 no-scrollbar pb-16 relative">
                  
                  <div className="classic-erp-frame space-y-2">
                     <div className="classic-erp-frame-title">Embroidery Specifications</div>

                     {/* Form details */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                           <span className="classic-erp-label red-label w-24">Job Card No:</span>
                           <input 
                             type="text"
                             className="classic-erp-input flex-1" 
                             value={header.jobCardNo} 
                             onChange={e => setHeader({...header, jobCardNo: e.target.value})}
                             required
                           />
                        </div>

                        <div className="flex items-center gap-2">
                           <span className="classic-erp-label red-label w-24">Challan Date:</span>
                           <input 
                             type="date" 
                             className="classic-erp-input flex-1" 
                             value={header.date} 
                             onChange={e => setHeader({...header, date: e.target.value})} 
                             required
                           />
                        </div>

                        <div className="flex items-center gap-2">
                           <span className="classic-erp-label red-label w-24">Emb. Unit:</span>
                           <select 
                             className="classic-erp-select flex-1" 
                             value={header.workerId}
                             onChange={(e) => setHeader({...header, workerId: e.target.value})}
                             required
                           >
                             <option value="">- Select Embroidery Partner -</option>
                             {workers.map(w => (
                               <option key={w._id} value={w._id}>{w.name}</option>
                             ))}
                           </select>
                        </div>

                        <div className="flex items-center gap-2">
                           <span className="classic-erp-label w-24">Book Type:</span>
                           <input 
                             type="text"
                             className="classic-erp-input flex-1" 
                             value="EMB. JOBWORK" 
                             readOnly 
                           />
                        </div>
                     </div>
                  </div>

                  <div className="classic-erp-frame space-y-2">
                     <div className="classic-erp-frame-title">Selected Lot Stock Issue Details</div>

                     {selectedLot ? (
                       <div className="space-y-3">
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono border-b border-[#808080] pb-2">
                           <div>
                             <span className="classic-erp-label text-slate-800">Lot ID:</span>
                             <span className="font-bold text-black uppercase ml-1">{selectedLot.lotId}</span>
                           </div>
                           <div>
                             <span className="classic-erp-label text-slate-800">Fabric Item:</span>
                             <span className="font-bold text-black uppercase ml-1">{selectedLot.itemId?.name || selectedLot.itemName}</span>
                           </div>
                           <div>
                             <span className="classic-erp-label text-slate-800">Available Pcs:</span>
                             <span className="font-bold text-black ml-1">{selectedLot.remainingPcs} Pcs</span>
                           </div>
                           <div>
                             <span className="classic-erp-label text-slate-800">Available Meters:</span>
                             <span className="font-bold text-black ml-1">{selectedLot.remainingMtrs} Mtrs</span>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <div className="flex items-center gap-2">
                              <span className="classic-erp-label w-24">Issue Pcs:</span>
                              <input 
                                 type="number" 
                                 className="classic-erp-input flex-1 font-bold text-right" 
                                 value={header.issuePcs} 
                                 onChange={e => setHeader({...header, issuePcs: e.target.value})}
                                 max={selectedLot.remainingPcs}
                                 placeholder="0"
                              />
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="classic-erp-label red-label w-24">Issue Mtrs:</span>
                              <input 
                                 type="number" 
                                 className="classic-erp-input flex-1 font-bold text-right" 
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
                       <div className="py-8 text-center text-red-800 font-bold uppercase tracking-wider text-[11px] bg-white border border-[#808080]">
                          SELECT A GREY LOT FROM THE AVAILABLE LOTS PANEL TO CONTINUE
                       </div>
                     )}
                  </div>

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
                        className="classic-erp-btn btn-blue"
                     >
                        Save & Issue
                     </button>
                  </div>

               </form>

               {/* Lot Selector Card Grid (Right Column 30%) */}
               <div className="flex-1 flex flex-col classic-erp-frame p-0 overflow-hidden w-80 shrink-0">
                  <div className="classic-erp-header bg-black text-white text-xs px-2 h-7 flex justify-between items-center font-bold tracking-wider uppercase shrink-0">
                     <span>Available Lots</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar bg-white">
                     {availableLots.map(lot => {
                        const isSelected = selectedLot?._id === lot._id;
                        return (
                          <div 
                             key={lot._id}
                             onClick={() => handleSelectLot(lot)}
                             className="p-2 border cursor-pointer select-none font-mono"
                             style={{
                               backgroundColor: isSelected ? '#ffffe1' : '#ffffff',
                               borderColor: isSelected ? '#000000' : '#d4d0c8',
                               borderWidth: '1px',
                               borderStyle: 'solid'
                             }}
                          >
                             <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-blue-900">{lot.lotId}</span>
                                <span className="px-1 bg-slate-200 text-slate-700 text-[9px] font-bold">
                                   {lot.itemId?.category || lot.category || 'Grey'}
                                </span>
                             </div>
                             <div className="space-y-0.5 text-[10px]">
                               <div className="flex justify-between items-center">
                                  <span className="text-slate-500">Item:</span>
                                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{lot.itemId?.name || lot.itemName}</span>
                               </div>
                               <div className="flex justify-between items-center">
                                  <span className="text-slate-500">Meters:</span>
                                  <span className="font-bold text-black">{lot.remainingMtrs.toFixed(2)} Mts</span>
                               </div>
                             </div>
                          </div>
                        );
                     })}
                     {availableLots.length === 0 && (
                       <div className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                          No grey fabric lots in stock
                       </div>
                     )}
                  </div>
               </div>
            </div>
          ) : (
            // View Embroidery Job Issue list tab
            <div className="flex-1 flex flex-col overflow-hidden">
               <div className="classic-erp-table-container flex-1">
                  <table className="classic-erp-table">
                     <thead>
                        <tr>
                           <th className="w-24">Date</th>
                           <th className="w-32">Job Card No</th>
                           <th>Embroidery Partner</th>
                           <th className="w-28 text-right">Issued Qty</th>
                           <th className="w-24 text-center">Status</th>
                        </tr>
                     </thead>
                     <tbody>
                        {jobWorkEntries.filter(j => j.processType === 'Embroidery').map((job) => (
                           <tr key={job._id}>
                              <td className="font-mono">{new Date(job.issueDate).toLocaleDateString()}</td>
                              <td className="font-bold text-blue-900">{job.jobCardNo}</td>
                              <td className="font-bold uppercase">{job.workerId?.name || 'N/A'}</td>
                              <td className="text-right font-mono font-bold">{job.issueQty} Mtrs</td>
                              <td className="text-center font-bold">
                                 <span style={{ color: job.status === 'Received' ? 'green' : 'brown' }}>
                                    {job.status}
                                 </span>
                              </td>
                           </tr>
                        ))}
                        {jobWorkEntries.filter(j => j.processType === 'Embroidery').length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-400 font-bold uppercase">
                              No Issued Embroidery Jobs Found
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

export default UpdateModal;
