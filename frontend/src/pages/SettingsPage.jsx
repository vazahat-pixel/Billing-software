import React from 'react';
import useStore from '../store/useStore';
import { Settings, Building2, User, Bell, Shield, Database, Save, Globe } from 'lucide-react';
import { ERPButton, FormField, ERPInput } from '../components/forms/FormElements';

const SettingsPage = () => {
  const { currentCompany } = useStore();

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-slate-500 text-sm">Manage your company profile, user permissions, and global configurations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
           {[
             { id: 'profile', label: 'Company Profile', icon: Building2 },
             { id: 'users', label: 'Users & Roles', icon: Shield },
             { id: 'notifications', label: 'Notifications', icon: Bell },
             { id: 'api', label: 'Integrations & API', icon: Globe },
             { id: 'database', label: 'Data & Backup', icon: Database }
           ].map(item => (
             <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                item.id === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-white hover:text-slate-900'
              }`}
             >
                <item.icon size={16} />
                {item.label}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                 <Building2 className="text-indigo-600" /> Organizational Profile
              </h3>
              
              <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Company Legal Name">
                       <ERPInput value={currentCompany.name} />
                    </FormField>
                    <FormField label="GSTIN">
                       <ERPInput value={currentCompany.gstin} />
                    </FormField>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Contact Number">
                       <ERPInput value={currentCompany.phone} />
                    </FormField>
                    <FormField label="State">
                       <ERPInput value={currentCompany.state} />
                    </FormField>
                 </div>

                 <FormField label="Registered Address">
                    <ERPInput value={currentCompany.address} />
                 </FormField>

                 <div className="pt-6 border-t border-slate-100 flex justify-end">
                    <ERPButton icon={Save} variant="indigo">Update Profile</ERPButton>
                 </div>
              </div>
           </div>

           <div className="bg-slate-50 p-8 rounded-3xl border border-dashed border-slate-200">
              <div className="flex items-start gap-4">
                 <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-indigo-600">
                    <Shield size={24} />
                 </div>
                 <div>
                    <h4 className="text-sm font-black text-slate-900">Advanced Security</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">Multi-factor authentication and role-based access control are enabled. Only authorized users can modify financial configurations or bulk delete records.</p>
                    <button className="mt-4 text-xs font-black text-indigo-600 hover:underline tracking-widest uppercase">Manage Permissions</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
