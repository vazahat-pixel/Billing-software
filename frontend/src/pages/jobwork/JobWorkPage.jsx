import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Plus, Download, List, ArrowRight, Activity } from 'lucide-react';
import { ERPButton } from '../../components/forms/FormElements';
import IssueModal from './IssueModal';
import UpdateModal from './UpdateModal';
import ReceiveModal from './ReceiveModal';
import JobReceiptModal from './JobReceiptModal';

const JobWorkPage = () => {
  const { jobWorkEntries, parties, fetchJobs, fetchParties } = useStore();

  useEffect(() => {
    fetchJobs();
    fetchParties();
  }, [fetchJobs, fetchParties]);
  
  const [modals, setModals] = useState({
    issue: false,
    jobIssue: false,
    receive: false,
    jobReceive: false
  });

  const toggleModal = (key, val) => setModals(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Architectural Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-10 border-2 border-black shadow-2xl">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-black text-white">
              <Activity size={28} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Process Registry</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Workflow</span>
                 <ArrowRight size={10} />
                 <span className="text-black">Job Work & Mill Control</span>
              </div>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
             onClick={() => toggleModal('issue', true)} 
             className="px-8 py-3 bg-black text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all border-2 border-black flex items-center gap-3"
          >
            <Plus size={14} /> Mill Issue
          </button>
          <button 
             onClick={() => toggleModal('jobIssue', true)} 
             className="px-8 py-3 bg-white text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all border-2 border-black flex items-center gap-3"
          >
            <Plus size={14} /> Job Issue
          </button>
          <div className="w-[2px] h-10 bg-slate-100 mx-2"></div>
          <button 
             onClick={() => toggleModal('receive', true)} 
             className="px-8 py-3 bg-slate-50 text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all border-2 border-black flex items-center gap-3"
          >
            <Download size={14} /> Mill Recv.
          </button>
          <button 
             onClick={() => toggleModal('jobReceive', true)} 
             className="px-8 py-3 bg-black text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all border-2 border-black flex items-center gap-3"
          >
            <Download size={14} /> Job Recv.
          </button>
        </div>
      </div>

      {/* Main Process Ledger */}
      <div className="bg-white border-2 border-black overflow-hidden flex flex-col shadow-2xl">
         <div className="p-6 border-b-2 border-black bg-white">
            <h3 className="text-[10px] font-black uppercase text-black tracking-[0.4em]">Active Process Intelligence</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                     <th className="px-8 py-5">Audit Date</th>
                     <th className="px-8 py-5">Voucher Ref</th>
                     <th className="px-8 py-5">Entity Name</th>
                     <th className="px-8 py-5">Process Schema</th>
                     <th className="px-8 py-5 text-right">Volume</th>
                     <th className="px-8 py-5">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-slate-50">
                  {jobWorkEntries.map(job => (
                     <tr key={job.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{job.issueDate ? new Date(job.issueDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-8 py-5 text-[10px] font-black text-black tracking-widest">#{job.jobCardNo}</td>
                        <td className="px-8 py-5 text-[11px] font-black text-black uppercase tracking-widest">{job.workerId?.name || 'UNKNOWN'}</td>
                        <td className="px-8 py-5 text-[10px] uppercase font-black text-black tracking-widest">
                           <span className="px-3 py-1 border-2 border-black bg-slate-50">{job.processType || 'PROCESS'}</span>
                        </td>
                        <td className="px-8 py-5 text-[12px] text-right font-black tracking-tighter">{job.issueQty || 0} <span className="text-[9px]">MTRS</span></td>
                        <td className="px-8 py-5">
                           <span className="px-3 py-1 border-2 border-black text-[9px] font-black uppercase tracking-widest">{job.status}</span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Modals */}
      <IssueModal isOpen={modals.issue} onClose={() => toggleModal('issue', false)} />
      <UpdateModal isOpen={modals.jobIssue} onClose={() => toggleModal('jobIssue', false)} />
      <ReceiveModal isOpen={modals.receive} onClose={() => toggleModal('receive', false)} />
      <JobReceiptModal isOpen={modals.jobReceive} onClose={() => toggleModal('jobReceive', false)} />
    </div>
  );
};

export default JobWorkPage;
