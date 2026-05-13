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
        <Modal isOpen={isOpen} onClose={onClose} title="New Customer Visit Entry" className="max-w-3xl bg-white">
            <div className="p-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Party Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-widest flex items-center gap-2">
                                <User size={12} className="text-black" /> Customer / Party *
                            </label>
                            <ERPSelect 
                                className="w-full h-11 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all"
                                value={formData.partyId}
                                onChange={(e) => setFormData({...formData, partyId: e.target.value})}
                                options={[
                                    { value: '', label: '-- Select Party --' },
                                    ...parties.map(p => ({ value: p._id, label: p.name }))
                                ]}
                                required
                            />
                        </div>

                        {/* Visit Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-widest flex items-center gap-2">
                                <Calendar size={12} className="text-black" /> Visit Date *
                            </label>
                            <ERPInput 
                                type="date"
                                className="w-full h-11 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all"
                                value={formData.visitDate}
                                onChange={(e) => setFormData({...formData, visitDate: e.target.value})}
                                required
                            />
                        </div>

                        {/* Purpose */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-widest flex items-center gap-2">
                                <Sparkles size={12} className="text-black" /> Purpose *
                            </label>
                            <ERPSelect 
                                className="w-full h-11 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all"
                                value={formData.purpose}
                                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                                options={[
                                    { value: 'Sales', label: 'Sales / Marketing' },
                                    { value: 'Payment Collection', label: 'Payment Collection' },
                                    { value: 'Service', label: 'Service / Support' },
                                    { value: 'Complaint', label: 'Complaint Handling' },
                                    { value: 'Other', label: 'Other' }
                                ]}
                            />
                        </div>

                        {/* Next Follow Up */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-black tracking-widest flex items-center gap-2">
                                <Calendar size={12} className="text-black" /> Next Follow-up
                            </label>
                            <ERPInput 
                                type="date"
                                className="w-full h-11 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all"
                                value={formData.nextFollowUp}
                                onChange={(e) => setFormData({...formData, nextFollowUp: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Discussion Points */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-black tracking-widest flex items-center gap-2">
                            <MessageSquare size={12} className="text-black" /> Discussion Points *
                        </label>
                        <textarea 
                            className="w-full min-h-[100px] text-sm p-3 border-2 border-slate-100 focus:border-black rounded-none outline-none transition-all placeholder:text-slate-300"
                            placeholder="Describe what was discussed during the visit..."
                            value={formData.discussion}
                            onChange={(e) => setFormData({...formData, discussion: e.target.value})}
                            required
                        />
                    </div>

                    {/* Outcome */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-black tracking-widest flex items-center gap-2">
                            <ClipboardCheck size={12} className="text-black" /> Expected Outcome / Remarks
                        </label>
                        <textarea 
                            className="w-full min-h-[60px] text-sm p-3 border-2 border-slate-100 focus:border-black rounded-none outline-none transition-all placeholder:text-slate-300"
                            placeholder="Any orders expected or specific commitments made..."
                            value={formData.outcome}
                            onChange={(e) => setFormData({...formData, outcome: e.target.value})}
                        />
                    </div>
                </form>

                <div className="mt-8 flex justify-between bg-black -mx-0 -mb-0 p-6">
                    <div className="flex gap-2 items-center">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Mandatory Compliance Fields</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose} 
                            className="px-6 py-2 bg-transparent text-white text-[11px] font-black uppercase tracking-widest border border-white/20 hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-10 py-2 bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    Save Entry <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
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
