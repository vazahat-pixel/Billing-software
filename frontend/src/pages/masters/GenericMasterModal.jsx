import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPInput } from '../../components/forms/FormElements';
import { X, Plus, Trash2, Search, Settings } from 'lucide-react';

const GenericMasterModal = ({ isOpen, onClose, type, readOnly = false }) => {
  const { subMasters, fetchSubMasters, addSubMaster, deleteSubMaster } = useStore();
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch sub-masters on open or type change
  useEffect(() => {
    if (isOpen && type) {
      fetchSubMasters(type);
      setName('');
      setHsnCode('');
      setGstRate('5');
      setSearchQuery('');
      setErrorMsg('');
    }
  }, [isOpen, type]);

  // Compute readable title
  const title = useMemo(() => {
    switch (type) {
      case 'AccountGroup': return 'Account Group Registry';
      case 'ItemGroup': return 'Item Group Registry';
      case 'City': return 'City Registry';
      case 'Transport': return 'Transport Agent Registry';
      case 'Color': return 'Color master Registry';
      case 'Design': return 'Design Master Registry';
      case 'HSN': return 'HSN Code Registry';
      default: return 'Master Registry';
    }
  }, [type]);

  const filteredList = useMemo(() => {
    return subMasters.filter(item => 
      item.type === type &&
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subMasters, type, searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (type === 'HSN') {
      if (!hsnCode.trim() || hsnCode.trim().length < 4) {
        setErrorMsg('Valid HSN code is required');
        return;
      }
      if (!name.trim()) {
        setErrorMsg('Description is required');
        return;
      }
    } else if (!name.trim()) {
      setErrorMsg('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = type === 'HSN'
        ? {
            type,
            name: name.trim(),
            extraFields: { code: hsnCode.trim(), description: name.trim(), gstRate: Number(gstRate || 5) }
          }
        : { type, name: name.trim() };
      await addSubMaster(payload);
      setName('');
      setHsnCode('');
      setGstRate('5');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to add record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteSubMaster(id);
    } catch (err) {
      alert(err.message || 'Failed to delete record');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
      <div className="bg-[#FDFCF9] w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-fadeIn">
        
        {/* Header */}
        <div className="px-10 py-6 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-black text-white rounded-2xl shadow-lg">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight italic">{title}<span className="text-slate-200">.</span></h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configuration Masters</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-black transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Add Record Form */}
        <div className="p-10 border-b border-slate-100 bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            {type === 'HSN' ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HSN Code</label>
                  <ERPInput value={hsnCode} onChange={e => setHsnCode(e.target.value)} placeholder="5208" maxLength={8} disabled={readOnly} className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                  <ERPInput value={name} onChange={e => setName(e.target.value)} placeholder="Cotton fabric" disabled={readOnly} className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GST Rate %</label>
                  <ERPInput type="number" value={gstRate} onChange={e => setGstRate(e.target.value)} disabled={readOnly} className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold text-[10px]" />
                </div>
              </div>
            ) : (
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master Item Name</label>
                  <ERPInput value={name} onChange={e => setName(e.target.value)} placeholder={`Enter new ${type} name...`} disabled={readOnly} className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black" />
                </div>
              </div>
            )}
            {!readOnly && (
              <button type="submit" disabled={isSubmitting} className="h-12 px-6 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50">
                <Plus size={16} /> Add Record
              </button>
            )}
          </form>
          {errorMsg && (
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-3">Error: {errorMsg}</p>
          )}
        </div>

        {/* List Section */}
        <div className="flex-1 p-10 flex flex-col overflow-hidden max-h-[40vh]">
          {/* Search bar */}
          <div className="relative mb-6 shrink-0">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search master record..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="px-6 py-4">{type === 'HSN' ? 'HSN / Description' : 'Name'}</th>
                  {type === 'HSN' && <th className="px-6 py-4">GST %</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredList.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4 font-bold text-black uppercase tracking-wider text-[10px]">
                      {type === 'HSN' ? `${item.extraFields?.code || item.name} — ${item.extraFields?.description || item.name}` : item.name}
                    </td>
                    {type === 'HSN' && (
                      <td className="px-6 py-4 text-[10px] font-bold">{item.extraFields?.gstRate ?? 5}%</td>
                    )}
                    <td className="px-6 py-4 text-right">
                      {!readOnly && (
                      <button 
                        onClick={() => handleDelete(item._id)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Record"
                      >
                        <Trash2 size={14} />
                      </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan="2" className="px-6 py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GenericMasterModal;
