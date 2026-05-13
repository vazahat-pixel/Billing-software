import React, { useState } from 'react';
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
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormInput from '../../components/ui/FormInput';
import SelectInput from '../../components/ui/SelectInput';
import Badge from '../../components/ui/Badge';

const JobWorkerMaster = () => {
  const [workers] = useState([
    { id: '1', name: 'Shree Sai Prints', type: 'Printing', rate: 12.50, contact: '98251XXXXX' },
    { id: '2', name: 'Krishna Dyeing', type: 'Dyeing', rate: 8.00, contact: '99040XXXXX' },
    { id: '3', name: 'Perfect Stitch', type: 'Stitching', rate: 45.00, contact: '88665XXXXX' },
  ]);

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
          <Button icon={Plus}>Add Worker</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Side: Form */}
        <div className="xl:col-span-4">
          <Card title="Add New Worker" icon={Hammer}>
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
               <div className="space-y-4">
                  <FormInput label="Worker / Unit Name" placeholder="e.g. Maruti Processors" required />
                  <SelectInput 
                    label="Work Type" 
                    options={[
                      { label: 'Printing', value: 'printing' },
                      { label: 'Dyeing', value: 'dyeing' },
                      { label: 'Stitching', value: 'stitching' },
                      { label: 'Finishing', value: 'finishing' },
                    ]} 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="Rate per MTR/PCS" placeholder="0.00" icon={Percent} />
                    <FormInput label="Mobile No" placeholder="98XXXXXXXX" icon={Phone} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-0.5">Special Instructions</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-[13px] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 h-24 resize-none"
                      placeholder="e.g. Standard shrinkage 2%..."
                    />
                  </div>
               </div>

               <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1">Clear</Button>
                  <Button className="flex-1">Register Worker</Button>
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
                            </td>
                            <td className="px-6 py-4">
                               <Badge variant="info">{w.type}</Badge>
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
                                  <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all"><Edit2 size={14} /></button>
                                  <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"><Trash2 size={14} /></button>
                               </div>
                            </td>
                         </tr>
                      ))}
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
