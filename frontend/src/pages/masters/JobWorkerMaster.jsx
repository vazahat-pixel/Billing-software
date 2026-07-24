import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Hammer, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone,
  Settings,
  Percent
} from 'lucide-react';
import useStore from '../../store/useStore';
import { notifyWarning, notifyError } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormInput from '../../components/ui/FormInput';
import SelectInput from '../../components/ui/SelectInput';
import Badge from '../../components/ui/Badge';

const JobWorkerMaster = () => {
  const { parties, fetchParties, addParty, updateParty, deleteParty } = useStore();
  const [name, setName] = useState('');
  const [workType, setWorkType] = useState('printing');
  const [rate, setRate] = useState('');
  const [contact, setContact] = useState('');
  const [instructions, setInstructions] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const workers = workersList();

  function workersList() {
    return parties
      .filter(p => p.type === 'Job Worker')
      .map(p => {
        let extra = { workType: 'Printing', rate: 0, instructions: '' };
        try {
          if (p.address && p.address.startsWith('{')) {
            extra = JSON.parse(p.address);
          } else if (p.address) {
            extra.instructions = p.address;
          }
        } catch (e) {
          // Fallback
        }
        return {
          id: p._id,
          name: p.name,
          type: extra.workType || 'Printing',
          rate: Number(extra.rate || 0),
          contact: p.mobile || '',
          instructions: extra.instructions || '',
          raw: p
        };
      })
      .filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      notifyWarning('Worker name is required');
      return;
    }

    const addressJson = JSON.stringify({
      workType,
      rate: Number(rate) || 0,
      instructions
    });

    try {
      if (editingId) {
        await updateParty(editingId, {
          name,
          type: 'Job Worker',
          mobile: contact,
          address: addressJson
        });
        setEditingId(null);
      } else {
        await addParty({
          name,
          type: 'Job Worker',
          group: 'Sundry Creditors', // Seed to default group
          mobile: contact,
          address: addressJson
        });
      }
      // Reset form
      setName('');
      setWorkType('printing');
      setRate('');
      setContact('');
      setInstructions('');
    } catch (err) {
      notifyError(err, 'Failed to save worker');
    }
  };

  const handleEdit = (w) => {
    setEditingId(w.id);
    setName(w.name);
    setWorkType(w.type.toLowerCase());
    setRate(w.rate || '');
    setContact(w.contact);
    setInstructions(w.instructions);
  };

  const handleDelete = async (id) => {
    if (!(await erpConfirm({
      title: 'Delete Job Worker',
      message: 'Are you sure you want to delete this job worker?',
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
      try {
        await deleteParty(id);
      } catch (err) {
        notifyError(err, 'Failed to delete worker');
      }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Job Worker Master</h1>
          <p className="text-slate-500 text-[13px] mt-1 font-medium">Configure rates and details for your processing partners.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              placeholder="Search workers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 w-64"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Side: Form */}
        <div className="xl:col-span-4">
          <Card title={editingId ? "Edit Worker" : "Add New Worker"} icon={Hammer}>
            <form className="space-y-5" onSubmit={handleSubmit}>
               <div className="space-y-4">
                  <FormInput 
                    label="Worker / Unit Name" 
                    placeholder="e.g. Maruti Processors" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                  <SelectInput 
                    label="Work Type" 
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    options={[
                      { label: 'Printing', value: 'printing' },
                      { label: 'Dyeing', value: 'dyeing' },
                      { label: 'Stitching', value: 'stitching' },
                      { label: 'Finishing', value: 'finishing' },
                    ]} 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput 
                      label="Rate per MTR/PCS" 
                      placeholder="0.00" 
                      icon={Percent} 
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                    <FormInput 
                      label="Mobile No" 
                      placeholder="98XXXXXXXX" 
                      icon={Phone} 
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-0.5">Special Instructions</label>
                    <textarea 
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-[13px] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 h-24 resize-none"
                      placeholder="e.g. Standard shrinkage 2%..."
                    />
                  </div>
               </div>

               <div className="flex gap-3 pt-4">
                  {editingId && (
                    <Button 
                      type="button" 
                      variant="secondary" 
                      className="flex-1" 
                      onClick={() => {
                        setEditingId(null);
                        setName('');
                        setWorkType('printing');
                        setRate('');
                        setContact('');
                        setInstructions('');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" className="flex-1">
                    {editingId ? "Update Worker" : "Register Worker"}
                  </Button>
               </div>
            </form>
          </Card>
        </div>

        {/* Right Side: Table */}
        <div className="xl:col-span-8">
          <Card noPadding title="Processing Partners">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50">
                      <tr>
                         <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Worker Name</th>
                         <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                         <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Standard Rate</th>
                         <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Contact</th>
                         <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {workers.map((w) => (
                         <tr key={w.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                               <p className="text-[13px] font-bold text-slate-800">{w.name}</p>
                               {w.instructions && (
                                 <p className="text-[10px] text-slate-400 mt-0.5">{w.instructions}</p>
                               )}
                            </td>
                            <td className="px-6 py-4">
                               <Badge variant="info">{w.type.toUpperCase()}</Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <span className="text-[13px] font-black text-slate-900">₹{w.rate.toFixed(2)}</span>
                               <span className="text-[10px] text-slate-400 font-bold ml-1">/m</span>
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-slate-500 text-[12px]">
                               {w.contact}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleEdit(w)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(w.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                               </div>
                            </td>
                         </tr>
                      ))}
                      {workers.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-[11px] text-slate-400 font-medium uppercase tracking-widest">
                            No job workers registered.
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default JobWorkerMaster;
