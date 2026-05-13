import React from 'react';
import useStore from '../store/useStore';
import { Settings, Building2, User, Bell, Shield, Database, Save, Globe, ArrowRight } from 'lucide-react';
import { ERPButton, FormField, ERPInput } from '../components/forms/FormElements';

const SettingsPage = () => {
  const { currentCompany } = useStore();

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Architectural Header */}
      <div className="bg-white p-10 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-black text-white">
              <Settings size={28} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">System Configuration</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Architecture</span>
                 <ArrowRight size={10} />
                 <span className="text-black">Control Panel</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Rigid Navigation Sidebar */}
        <div className="space-y-1">
           {[
             { id: 'profile', label: 'Dossier Profile', icon: Building2 },
             { id: 'users', label: 'Access Control', icon: Shield },
             { id: 'notifications', label: 'Audit Alerts', icon: Bell },
             { id: 'api', label: 'API Protocols', icon: Globe },
             { id: 'database', label: 'Core Repository', icon: Database }
           ].map(item => (
             <button
              key={item.id}
              className={`w-full flex items-center gap-4 px-6 py-4 transition-all text-[10px] font-black uppercase tracking-[0.2em] border-2 ${
                item.id === 'profile' ? 'bg-black text-white border-black shadow-xl' : 'text-slate-400 border-transparent hover:border-black hover:text-black'
              }`}
             >
                <item.icon size={16} />
                {item.label}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-10">
           <div className="bg-white p-10 border-2 border-black shadow-2xl">
              <h3 className="text-[12px] font-black text-black mb-10 flex items-center gap-4 uppercase tracking-[0.4em]">
                 <Building2 className="text-black" /> Organizational Architecture
                 <div className="h-[2px] flex-1 bg-slate-50"></div>
              </h3>
              
              <div className="space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <FormField label="LEGAL ENTITY NAME">
                       <ERPInput value={currentCompany.name} className="h-14" />
                    </FormField>
                    <FormField label="GST REGISTRY (GSTIN)">
                       <ERPInput value={currentCompany.gstin} className="h-14" />
                    </FormField>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <FormField label="PRIMARY CONTACT">
                       <ERPInput value={currentCompany.phone} className="h-14" />
                    </FormField>
                    <FormField label="JURISDICTION STATE">
                       <ERPInput value={currentCompany.state} className="h-14" />
                    </FormField>
                 </div>

                 <FormField label="REGISTERED HEADQUARTERS">
                    <ERPInput value={currentCompany.address} className="h-14" />
                 </FormField>

                 <div className="pt-10 border-t-2 border-slate-50 flex justify-end">
                    <ERPButton icon={Save} variant="indigo" className="px-14 h-14">Commit Configuration</ERPButton>
                 </div>
              </div>
           </div>

           <div className="bg-slate-50 p-10 border-2 border-dashed border-slate-200">
              <div className="flex items-start gap-6">
                 <div className="p-4 bg-white border-2 border-black text-black">
                    <Shield size={28} />
                 </div>
                 <div>
                    <h4 className="text-[11px] font-black text-black uppercase tracking-[0.2em]">Security Protocol</h4>
                    <p className="text-[10px] text-slate-400 mt-2 max-w-xl font-black uppercase tracking-widest leading-loose">Role-based access control (RBAC) is enforced. Unauthorized modification of fiscal schemas or audit trails is prohibited by system policy.</p>
                    <button className="mt-6 text-[9px] font-black text-black hover:bg-black hover:text-white transition-all px-4 py-2 border-2 border-black uppercase tracking-[0.3em]">Configure Roles</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
