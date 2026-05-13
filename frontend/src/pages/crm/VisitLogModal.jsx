import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { Calendar, User, MessageSquare, ClipboardCheck, ArrowRight } from 'lucide-react';

const VisitLogModal = ({ isOpen, onClose, onSuccess }) => {
    const { parties, fetchParties } = useStore();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        partyId: '',
        visitDate: new Date().toISOString().split('T')[0],
        purpose: 'Sales',
        discussion: '',
        outcome: '',
        nextFollowUp: '',
        status: 'Completed'
    });

    useEffect(() => {
        if (isOpen && parties.length === 0) {
            fetchParties();
        }
    }, [isOpen, parties.length, fetchParties]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!formData.partyId || !formData.discussion) {
            alert('Please fill in required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/visits', formData);
            if (onSuccess) onSuccess(response.data);
            onClose();
        } catch (err) {
            alert('Error saving visit: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Field Intelligence Log" className="max-w-4xl bg-white p-0 overflow-hidden border-none shadow-2xl">
            <div className="flex flex-col h-full">
                <div className="p-10 bg-black text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Visit Registry<span className="text-slate-500">.</span></h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">CRM Intelligence • Field Observation</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-2 gap-10">
                        {/* Party Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-[0.2em] flex items-center gap-2">
                                <User size={12} /> Entity Designation
                            </label>
                            <ERPSelect
                                className="w-full h-12 text-[11px] font-black border-2 border-slate-100 focus:border-black rounded-xl transition-all uppercase tracking-widest bg-slate-50 focus:bg-white"
                                value={formData.partyId}
                                onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
                                options={[
                                    { value: '', label: '-- SELECT ENTITY --' },
                                    ...parties.map(p => ({ value: p._id, label: p.name }))
                                ]}
                                required
                            />
                        </div>

                        {/* Visit Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-[0.2em] flex items-center gap-2">
                                <Calendar size={12} /> Registry Date
                            </label>
                            <ERPInput
                                type="date"
                                className="w-full h-12 text-[11px] font-black border-2 border-slate-100 focus:border-black rounded-xl transition-all uppercase tracking-widest bg-slate-50 focus:bg-white"
                                value={formData.visitDate}
                                onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                                required
                            />
                        </div>

                        {/* Purpose */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-[0.2em] flex items-center gap-2">
                                <MessageSquare size={12} /> Strategic Purpose
                            </label>
                            <ERPSelect
                                className="w-full h-12 text-[11px] font-black border-2 border-slate-100 focus:border-black rounded-xl transition-all uppercase tracking-widest bg-slate-50 focus:bg-white"
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                options={[
                                    { value: 'Sales', label: 'SALES ACQUISITION' },
                                    { value: 'Payment Collection', label: 'FINANCIAL COLLECTION' },
                                    { value: 'Service', label: 'SERVICE PROTOCOL' },
                                    { value: 'Complaint', label: 'ANOMALY HANDLING' },
                                    { value: 'Other', label: 'GENERAL ADVISORY' }
                                ]}
                            />
                        </div>

                        {/* Next Follow Up */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-[0.2em] flex items-center gap-2">
                                <Calendar size={12} /> Follow-up Protocol
                            </label>
                            <ERPInput
                                type="date"
                                className="w-full h-12 text-[11px] font-black border-2 border-slate-100 focus:border-black rounded-xl transition-all uppercase tracking-widest bg-slate-50 focus:bg-white"
                                value={formData.nextFollowUp}
                                onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Discussion Points */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-black tracking-[0.2em] flex items-center gap-2">
                            <ClipboardCheck size={12} /> Observation Narrative
                        </label>
                        <textarea
                            className="w-full min-h-[120px] text-[11px] font-black p-5 border-2 border-slate-100 focus:border-black rounded-3xl outline-none transition-all placeholder:text-slate-300 uppercase tracking-widest bg-slate-50 focus:bg-white resize-none"
                            placeholder="TRANSCRIBE CORE OBSERVATIONS..."
                            value={formData.discussion}
                            onChange={(e) => setFormData({ ...formData, discussion: e.target.value })}
                            required
                        />
                    </div>
                </form>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-10 py-4 bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-black transition-all rounded-xl border border-slate-200"
                    >
                        Abort Entry
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-14 py-4 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-xl shadow-xl flex items-center gap-3"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                Commit Registry <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default VisitLogModal;

// Mock Sparkles icon if not available
const Sparkles = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="m5 3 1 1" /><path d="m19 17 1 1" /><path d="M3 5l1 1" /><path d="m17 19 1 1" /><path d="m5 21 1-1" /><path d="m19 7 1-1" /><path d="m21 5-1 1" /><path d="M5 19l-1 1" />
    </svg>
);
