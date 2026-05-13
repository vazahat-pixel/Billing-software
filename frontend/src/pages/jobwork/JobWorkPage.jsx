import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Plus, Download, List } from 'lucide-react';
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Job Work & Process</h1>
          <p className="text-slate-500 text-sm">Legacy-grade tracking for Mill and Embroidery process dispatches.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => toggleModal('issue', true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={16} /> Mill Issue
          </button>
          <button onClick={() => toggleModal('jobIssue', true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={16} /> Job Issue
          </button>
          <button onClick={() => toggleModal('receive', true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2">
            <Download size={16} /> Mill Receive
          </button>
          <button onClick={() => toggleModal('jobReceive', true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2">
            <Download size={16} /> Job Receive
          </button>
        </div>
      </div>

      {/* Simplified List View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Process List</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50">
                  <tr className="border-b border-slate-100">
                     <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Date</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">VNo</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Party Name</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Process Type</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Qty</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {jobWorkEntries.map(job => (
                     <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold">{job.date || '05/05/2026'}</td>
                        <td className="px-6 py-4 text-xs font-bold">#{job.vno || '1'}</td>
                        <td className="px-6 py-4 text-xs font-bold">{parties.find(p => p.id === job.partyId)?.name || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs uppercase font-black text-indigo-600">{job.book || 'PROCESS'}</td>
                        <td className="px-6 py-4 text-xs text-right font-black">{job.mtrs || 0} M</td>
                        <td className="px-6 py-4">
                           <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-bold uppercase">In Process</span>
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
