import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { 
  Plus, Users, Package, MapPin, Hash, Search, 
  Edit2, Trash2, ArrowRight, User, Phone, 
  Globe, CreditCard, Banknote, FileText, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ERPButton } from '../../components/forms/FormElements';
import PartyModal from './PartyModal';
import ItemModal from './ItemModal';

const MasterPage = () => {
  const { parties, items, fetchParties, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('parties');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modals, setModals] = useState({ party: false, item: false });

  useEffect(() => {
    fetchParties();
    fetchItems();
  }, [fetchParties, fetchItems]);

  const tabs = [
    { id: 'parties', label: 'Parties', icon: Users, count: parties.length },
    { id: 'items', label: 'Items', icon: Package, count: items.length },
    { id: 'hsn', label: 'HSN', icon: Hash, count: 2 },
    { id: 'warehouses', label: 'Warehouses', icon: MapPin, count: 3 }
  ];

  const handleRowClick = (item) => {
    setSelectedItem(item);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden gap-6 animate-fadeIn">
      {/* Left Section - Main Content */}
      <div className={`flex-1 flex flex-col gap-6 transition-all duration-500 ${selectedItem ? 'w-2/3' : 'w-full'}`}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                {activeTab === 'parties' ? <Users size={24} /> : <Package size={24} />}
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Master Management</h1>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                   <span>Inventory</span>
                   <ArrowRight size={10} />
                   <span className="text-indigo-600">{activeTab}</span>
                </div>
             </div>
          </div>
          <ERPButton 
             variant="indigo" 
             icon={Plus} 
             onClick={() => setModals({ ...modals, [activeTab === 'parties' ? 'party' : 'item']: true })}
          >
             New {activeTab === 'parties' ? 'Party' : 'Item'}
          </ERPButton>
        </div>

        {/* Tabs & Search */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedItem(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.id 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-lg text-[9px] ${activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
           </div>
           <div className="relative mr-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                placeholder="Search masters..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 w-48 transition-all focus:w-64"
              />
           </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
           <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 backdrop-blur-md">
                       {activeTab === 'parties' ? (
                         <>
                           <th className="px-6 py-4">Name</th>
                           <th className="px-6 py-4">Type</th>
                           <th className="px-6 py-4">Mobile</th>
                           <th className="px-6 py-4">State</th>
                         </>
                       ) : (
                         <>
                           <th className="px-6 py-4">Item Name</th>
                           <th className="px-6 py-4">Design</th>
                           <th className="px-6 py-4">HSN</th>
                           <th className="px-6 py-4">Unit</th>
                         </>
                       )}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {activeTab === 'parties' && parties.map(party => (
                      <tr 
                        key={party.id} 
                        onClick={() => handleRowClick(party)}
                        className={`cursor-pointer transition-all ${
                          selectedItem?.id === party.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'
                        }`}
                      >
                         <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-800">{party.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{party.gstin || 'No GSTIN'}</p>
                         </td>
                         <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                              party.type === 'Customer' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {party.type}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-xs font-bold text-slate-600">{party.mobile}</td>
                         <td className="px-6 py-4 text-xs font-medium text-slate-500">{party.state}</td>
                      </tr>
                    ))}
                    {activeTab === 'items' && items.map(item => (
                      <tr 
                        key={item.id} 
                        onClick={() => handleRowClick(item)}
                        className={`cursor-pointer transition-all ${
                          selectedItem?.id === item.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'
                        }`}
                      >
                         <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-800">{item.itemName}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{item.category}</p>
                         </td>
                         <td className="px-6 py-4 text-xs font-black text-indigo-600 uppercase">{item.design}</td>
                         <td className="px-6 py-4 text-xs font-bold text-slate-500">{item.hsnCode}</td>
                         <td className="px-6 py-4 text-xs font-black text-slate-700">{item.unit}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Right Smart Panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-[400px] bg-white border-l border-slate-100 shadow-2xl flex flex-col z-20"
          >
             <SmartPanel 
                data={selectedItem} 
                onClose={() => setSelectedItem(null)} 
                type={activeTab}
             />
          </motion.div>
        )}
      </AnimatePresence>

      <PartyModal isOpen={modals.party} onClose={() => setModals({ ...modals, party: false })} />
      <ItemModal isOpen={modals.item} onClose={() => setModals({ ...modals, item: false })} />
    </div>
  );
};

const SmartPanel = ({ data, onClose, type }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
       {/* Panel Header */}
       <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{type === 'parties' ? 'Account Details' : 'Item Intelligence'}</h3>
             <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">{data.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><Plus className="rotate-45" size={20} /></button>
       </div>

       {/* Panel Content */}
       <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="flex flex-col items-center text-center">
             <div className="w-20 h-20 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100 flex items-center justify-center text-white mb-4">
                {type === 'parties' ? <User size={32} strokeWidth={2.5} /> : <Package size={32} strokeWidth={2.5} />}
             </div>
             <h2 className="text-lg font-black text-slate-900">{type === 'parties' ? data.name : data.itemName}</h2>
             <span className="text-[10px] font-black uppercase px-3 py-1 bg-slate-100 text-slate-500 rounded-full mt-2 tracking-widest">{type === 'parties' ? data.type : data.design}</span>
          </div>

          <div className="space-y-6">
             <PanelSection title="Identification">
                {type === 'parties' ? (
                  <>
                    <DetailItem icon={Phone} label="Mobile" value={data.mobile} />
                    <DetailItem icon={Globe} label="GSTIN" value={data.gstin || 'Unregistered'} />
                    <DetailItem icon={CreditCard} label="PAN No" value={data.pan || 'Not Provided'} />
                    <DetailItem icon={MapPin} label="State" value={data.state} />
                  </>
                ) : (
                  <>
                    <DetailItem icon={Hash} label="HSN Code" value={data.hsnCode} />
                    <DetailItem icon={ShoppingBag} label="Design" value={data.design} />
                    <DetailItem icon={Package} label="Category" value={data.category} />
                    <DetailItem icon={FileText} label="Base Unit" value={data.unit} />
                  </>
                )}
             </PanelSection>

             <PanelSection title="Financial & Stock">
                {type === 'parties' ? (
                  <>
                    <DetailItem icon={Banknote} label="Op. Balance" value={`₹ ${data.openingBalance}`} />
                    <DetailItem icon={CreditCard} label="Credit Limit" value={`₹ ${data.creditLimit}`} />
                    <DetailItem icon={FileText} label="Address" value={data.address} />
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Available</p>
                          <p className="text-lg font-black text-emerald-700">1,240 Mtrs</p>
                       </div>
                       <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                          <p className="text-[10px] font-bold text-rose-600 uppercase">Pending</p>
                          <p className="text-lg font-black text-rose-700">450 Mtrs</p>
                       </div>
                    </div>
                  </>
                )}
             </PanelSection>
          </div>
       </div>

       {/* Panel Actions */}
       <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
          <ERPButton variant="secondary" icon={Edit2} className="text-[11px] h-12">Modify</ERPButton>
          <ERPButton variant="indigo" icon={ArrowRight} className="text-[11px] h-12">{type === 'parties' ? 'Ledger' : 'Stock'}</ERPButton>
          <button className="col-span-2 py-3 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center gap-2">
             <Trash2 size={14} /> Remove from Master
          </button>
       </div>
    </div>
  );
};

const PanelSection = ({ title, children }) => (
  <div className="space-y-4">
     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <div className="h-[1px] flex-1 bg-slate-100"></div>
        {title}
        <div className="h-[1px] flex-1 bg-slate-100"></div>
     </h4>
     <div className="space-y-3">{children}</div>
  </div>
);

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-4 group">
     <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
        <Icon size={16} />
     </div>
     <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
        <p className="text-xs font-black text-slate-700">{value}</p>
     </div>
  </div>
);

export default MasterPage;
